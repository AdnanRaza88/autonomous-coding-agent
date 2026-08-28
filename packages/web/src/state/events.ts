import type { AgentResult, AgentTask, OrchestratorEvent } from "@agent-core/types"

export interface RunView {
  runId: string | null
  phase: "idle" | "planning" | "running" | "complete" | "error"
  goal: string
  tasks: AgentTask[]
  results: AgentResult[]
  log: string[]
  error?: string
}

export const emptyRun = (): RunView => ({
  runId: null,
  phase: "idle",
  goal: "",
  tasks: [],
  results: [],
  log: [],
})

export function reduceRun(view: RunView, event: OrchestratorEvent): RunView {
  if (event.type === "planning") {
    return { ...view, phase: "planning", log: [...view.log, "planning"] }
  }
  if (event.type === "plan_ready") {
    return {
      ...view,
      phase: "running",
      tasks: event.tasks.map((t) => ({ ...t })),
      log: [...view.log, `plan ${event.tasks.length} tasks`],
    }
  }
  if (event.type === "agent_start") {
    return {
      ...view,
      tasks: setStatus(view.tasks, event.taskId, "running"),
      log: [...view.log, `start ${event.taskId}`],
    }
  }
  if (event.type === "agent_verify") {
    return {
      ...view,
      tasks: setStatus(view.tasks, event.taskId, event.pass ? "verifying" : "retrying"),
      log: [...view.log, `verify ${event.taskId} attempt ${event.attempt} ${event.pass ? "pass" : "fail"}`],
    }
  }
  if (event.type === "agent_done") {
    return {
      ...view,
      tasks: setStatus(view.tasks, event.taskId, "passed"),
      log: [...view.log, `done ${event.taskId}`],
    }
  }
  if (event.type === "run_complete") {
    return {
      ...view,
      phase: "complete",
      results: event.results,
      log: [...view.log, "complete"],
    }
  }
  return {
    ...view,
    phase: "error",
    error: event.message,
    log: [...view.log, `error ${event.message}`],
  }
}

function setStatus(tasks: AgentTask[], id: string, status: AgentTask["status"]): AgentTask[] {
  return tasks.map((t) => (t.id === id ? { ...t, status } : t))
}
