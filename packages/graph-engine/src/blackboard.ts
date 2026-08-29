import type { AgentResult, AgentTask, OrchestratorEvent, SharedSpec } from "@agent-core/types"

export type RunStatus = "planning" | "running" | "complete" | "error"

export type RunRecord = {
  id: string
  spec: SharedSpec | null
  tasks: AgentTask[]
  results: AgentResult[]
  events: OrchestratorEvent[]
  status: RunStatus
  roles: Map<string, string>
  error?: string
  createdAt: number
}

const runs = new Map<string, RunRecord>()
const waiters = new Map<string, Set<() => void>>()

export function createRecord(id: string): RunRecord {
  const rec: RunRecord = {
    id,
    spec: null,
    tasks: [],
    results: [],
    events: [],
    status: "planning",
    roles: new Map(),
    createdAt: Date.now(),
  }
  runs.set(id, rec)
  return rec
}

export function getRecord(runId: string): RunRecord | undefined {
  return runs.get(runId)
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

export function pushEvent(runId: string, event: OrchestratorEvent): void {
  const rec = requireRecord(runId)
  rec.events.push(event)
  if (event.type === "run_complete") rec.status = "complete"
  if (event.type === "error") rec.status = "error"
  wake(runId)
}

export function markRunning(runId: string): void {
  requireRecord(runId).status = "running"
}

export function waitForEvent(runId: string): Promise<void> {
  const rec = runs.get(runId)
  if (!rec || rec.status === "complete" || rec.status === "error") {
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
    if (!latest || latest.status === "complete" || latest.status === "error") {
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
