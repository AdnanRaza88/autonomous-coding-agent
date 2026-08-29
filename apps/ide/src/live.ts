import type { AgentTask, OrchestratorEvent } from "@agent-core/types"
import { emptyStatus, foldEvent, statusFromTasks } from "./status.js"
import type { StatusSnapshot } from "./types.js"

export type LiveRunSnapshot = {
  runId: string
  status: "planning" | "running" | "complete" | "error"
  goal?: string
  tasks: AgentTask[]
  results: { taskId: string; output: string; attempt: number; passed: boolean }[]
  events: OrchestratorEvent[]
  error?: string
}

export type LiveHandle = {
  close(): void
}

export function runSnapshotUrl(origin: string, runId: string): string {
  return `${origin.replace(/\/$/, "")}/api/runs/${encodeURIComponent(runId)}`
}

export function runEventsUrl(origin: string, runId: string, after?: number): string {
  const base = `${origin.replace(/\/$/, "")}/api/runs/${encodeURIComponent(runId)}/events`
  if (after === undefined || after < 0) return base
  return `${base}?after=${after}`
}

export function permissionEventsUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/permissions/events`
}

export function parseSseBlock(chunk: string): { event: string; data: string; id?: string }[] {
  const frames: { event: string; data: string; id?: string }[] = []
  for (const part of chunk.split("\n\n")) {
    if (!part.trim()) continue
    let event = "message"
    let id: string | undefined
    const dataLines: string[] = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length) frames.push(id ? { event, data: dataLines.join("\n"), id } : { event, data: dataLines.join("\n") })
  }
  return frames
}

export function statusFromSnapshot(snap: LiveRunSnapshot): StatusSnapshot {
  if (snap.error) return statusFromTasks(snap.tasks, snap.error)
  if (snap.status === "planning" && snap.tasks.length === 0) {
    return { ...emptyStatus(), phase: "planning", label: "Planning" }
  }
  let status = snap.tasks.length ? statusFromTasks(snap.tasks, snap.error) : emptyStatus()
  for (const event of snap.events) status = foldEvent(status, event, snap.tasks)
  return status
}

export async function fetchRunSnapshot(
  origin: string,
  runId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveRunSnapshot> {
  const res = await fetchImpl(runSnapshotUrl(origin, runId))
  if (!res.ok) throw new Error(`run snapshot ${res.status}`)
  return (await res.json()) as LiveRunSnapshot
}

export function nextBackoff(attempt: number, base = 250, cap = 8000): number {
  return Math.min(cap, base * 2 ** Math.max(0, attempt))
}

export async function readSseFrames(
  body: string,
  onFrame: (event: OrchestratorEvent, id?: number) => boolean | void,
): Promise<void> {
  for (const frame of parseSseBlock(body)) {
    if (frame.event !== "orchestrator" && frame.event !== "message") continue
    let parsed: { event?: OrchestratorEvent } | undefined
    try {
      parsed = JSON.parse(frame.data) as { event?: OrchestratorEvent }
    } catch {
      continue
    }
    if (!parsed?.event) continue
    const id = frame.id !== undefined ? Number(frame.id) : undefined
    const stop = onFrame(parsed.event, Number.isFinite(id) ? id : undefined)
    if (stop) return
  }
}

export function watchIdeRun(opts: {
  origin: string
  runId: string
  onStatus: (status: StatusSnapshot) => void
  onEvent?: (event: OrchestratorEvent) => void
  fetchImpl?: typeof fetch
  hydrate?: LiveRunSnapshot
}): LiveHandle {
  let closed = false
  const fetchImpl = opts.fetchImpl ?? fetch
  void (async () => {
    const snap = opts.hydrate ?? (await fetchRunSnapshot(opts.origin, opts.runId, fetchImpl))
    if (closed) return
    let tasks = snap.tasks.map((t) => ({ ...t }))
    let status = statusFromSnapshot(snap)
    opts.onStatus(status)
    let after = snap.events.length - 1
    const res = await fetchImpl(runEventsUrl(opts.origin, opts.runId, after))
    if (!res.ok || closed) return
    const text = await res.text()
    if (closed) return
    await readSseFrames(text, (event, id) => {
      if (event.type === "plan_ready") tasks = event.tasks.map((t) => ({ ...t }))
      status = foldEvent(status, event, tasks)
      opts.onStatus(status)
      opts.onEvent?.(event)
      if (id !== undefined) after = id
      return event.type === "run_complete" || event.type === "error"
    })
    void after
  })().catch(() => {
    if (!closed) opts.onStatus({ ...emptyStatus(), phase: "error", label: "stream failed" })
  })
  return {
    close() {
      closed = true
    },
  }
}
