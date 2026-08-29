import type { AgentResult, AgentTask, OrchestratorEvent, SharedSpec, TokenUsage } from "@agent-core/types"

export type RunStatus = "planning" | "running" | "complete" | "error" | "cancelled"

export type RunRecord = {
  id: string
  spec: SharedSpec | null
  tasks: AgentTask[]
  results: AgentResult[]
  events: OrchestratorEvent[]
  status: RunStatus
  roles: Map<string, string>
  error?: string
  cancelled: boolean
  createdAt: number
  usage: TokenUsage
}

const runs = new Map<string, RunRecord>()
const waiters = new Map<string, Set<() => void>>()

const TERMINAL: RunStatus[] = ["complete", "error", "cancelled"]

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL.includes(status)
}

export function createRecord(id: string): RunRecord {
  const rec: RunRecord = {
    id,
    spec: null,
    tasks: [],
    results: [],
    events: [],
    status: "planning",
    roles: new Map(),
    cancelled: false,
    createdAt: Date.now(),
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
  }
  runs.set(id, rec)
  return rec
}

export function getRecord(runId: string): RunRecord | undefined {
  return runs.get(runId)
}

export function listRecords(): RunRecord[] {
  return [...runs.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export function requireRecord(runId: string): RunRecord {
  const rec = runs.get(runId)
  if (!rec) throw new Error(`unknown run: ${runId}`)
  return rec
}

export function setSpec(runId: string, spec: SharedSpec): void {
  const rec = requireRecord(runId)
  rec.spec = spec
}

export function setTasks(runId: string, tasks: AgentTask[], roles?: Map<string, string>): void {
  const rec = requireRecord(runId)
  rec.tasks = tasks
  if (roles) rec.roles = roles
}

export function updateTask(runId: string, taskId: string, patch: Partial<AgentTask>): AgentTask {
  const rec = requireRecord(runId)
  const idx = rec.tasks.findIndex((t) => t.id === taskId)
  if (idx < 0) throw new Error(`unknown task: ${taskId}`)
  const next = { ...rec.tasks[idx], ...patch }
  rec.tasks[idx] = next
  return next
}

export function addResult(runId: string, result: AgentResult): void {
  const rec = requireRecord(runId)
  const existing = rec.results.findIndex((r) => r.taskId === result.taskId)
  if (existing >= 0) rec.results[existing] = result
  else rec.results.push(result)
}

export function requestCancel(runId: string): boolean {
  const rec = getRecord(runId)
  if (!rec || isTerminal(rec.status)) return false
  rec.cancelled = true
  return true
}

export function wasCancelled(runId: string): boolean {
  return Boolean(getRecord(runId)?.cancelled)
}

export function pushEvent(runId: string, event: OrchestratorEvent): void {
  const rec = requireRecord(runId)
  rec.events.push(event)
  if (event.type === "run_complete") rec.status = "complete"
  if (event.type === "error") rec.status = "error"
  if (event.type === "run_cancelled") {
    rec.status = "cancelled"
    rec.error = event.reason
  }
  wake(runId)
}

export function addUsage(runId: string, delta: TokenUsage): TokenUsage {
  const rec = requireRecord(runId)
  rec.usage = {
    inputTokens: rec.usage.inputTokens + delta.inputTokens,
    outputTokens: rec.usage.outputTokens + delta.outputTokens,
    calls: rec.usage.calls + delta.calls,
  }
  return rec.usage
}

export function markRunning(runId: string): void {
  const rec = requireRecord(runId)
  if (!rec.cancelled && rec.status === "planning") rec.status = "running"
}

export function waitForEvent(runId: string): Promise<void> {
  const rec = runs.get(runId)
  if (!rec || isTerminal(rec.status)) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let bucket = waiters.get(runId)
    if (!bucket) {
      bucket = new Set()
      waiters.set(runId, bucket)
    }
    bucket.add(resolve)
    const latest = runs.get(runId)
    if (!latest || isTerminal(latest.status)) {
      wake(runId)
    }
  })
}

export function clearRuns(): void {
  runs.clear()
  waiters.clear()
}

function wake(runId: string): void {
  const bucket = waiters.get(runId)
  if (!bucket || bucket.size === 0) return
  waiters.delete(runId)
  for (const fn of bucket) fn()
}
