import type { AgentResult, AgentTask, OrchestratorEvent } from "@agent-core/types"
import type { RunSnapshot } from "../api/contract.js"

export interface RunView {
  runId: string | null
  phase: "idle" | "planning" | "running" | "complete" | "error" | "cancelled"
  goal: string
  tasks: AgentTask[]
  results: AgentResult[]
  log: string[]
  error?: string
  cursor: number
}

export const emptyRun = (): RunView => ({
  runId: null,
  phase: "idle",
  goal: "",
  tasks: [],
  results: [],
  log: [],
  cursor: -1,
})

export function reduceRun(view: RunView, event: OrchestratorEvent): RunView {
  const next = { ...view, cursor: view.cursor + 1 }
  if (event.type === "planning") {
    return { ...next, phase: "planning", log: [...view.log, "planning"] }
  }
  if (event.type === "plan_ready") {
    return {
      ...next,
      phase: "running",
      tasks: event.tasks.map((t) => ({ ...t })),
      log: [...view.log, `plan ${event.tasks.length} tasks`],
    }
  }
  if (event.type === "agent_start") {
    return {
      ...next,
      tasks: setStatus(view.tasks, event.taskId, "running"),
      log: [...view.log, `start ${event.taskId}`],
    }
  }
  if (event.type === "agent_verify") {
    return {
      ...next,
      tasks: setStatus(view.tasks, event.taskId, event.pass ? "verifying" : "retrying"),
      log: [...view.log, `verify ${event.taskId} attempt ${event.attempt} ${event.pass ? "pass" : "fail"}`],
    }
  }
  if (event.type === "agent_done") {
    return {
      ...next,
      tasks: setStatus(view.tasks, event.taskId, "passed"),
      log: [...view.log, `done ${event.taskId}`],
    }
  }
  if (event.type === "run_complete") {
    return {
      ...next,
      phase: "complete",
      results: event.results,
      log: [...view.log, "complete"],
    }
  }
  if (event.type === "run_cancelled") {
    return {
      ...next,
      phase: "cancelled",
      error: event.reason,
      log: [...view.log, `cancelled ${event.reason}`],
    }
  }
  return {
    ...next,
    phase: "error",
    error: event.message,
    log: [...view.log, `error ${event.message}`],
  }
}

export function hydrateRun(snapshot: RunSnapshot & { goal?: string }): RunView {
  let view: RunView = {
    ...emptyRun(),
    runId: snapshot.runId,
    goal: snapshot.goal ?? "",
  }
  for (const event of snapshot.events) view = reduceRun(view, event)
  if (snapshot.tasks.length) view = { ...view, tasks: snapshot.tasks.map((t) => ({ ...t })) }
  if (snapshot.results.length) view = { ...view, results: snapshot.results.map((r) => ({ ...r })) }
  if (snapshot.status === "cancelled") view = { ...view, phase: "cancelled", error: snapshot.error }
  else if (snapshot.error) view = { ...view, phase: "error", error: snapshot.error }
  else if (snapshot.status === "complete") view = { ...view, phase: "complete" }
  else if (snapshot.status === "planning" && view.phase === "idle") view = { ...view, phase: "planning" }
  view = { ...view, cursor: snapshot.events.length - 1 }
  return view
}

function setStatus(tasks: AgentTask[], id: string, status: AgentTask["status"]): AgentTask[] {
  return tasks.map((t) => (t.id === id ? { ...t, status } : t))
}
