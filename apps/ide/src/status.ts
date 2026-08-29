import type { AgentTask, OrchestratorEvent } from "@agent-core/types"
import type { RunPhase, StatusSnapshot } from "./types.js"

export function emptyStatus(): StatusSnapshot {
  return { phase: "idle", label: "Agent idle", running: 0, verifying: 0, passed: 0, failed: 0, total: 0 }
}

export function statusFromTasks(tasks: AgentTask[], error?: string): StatusSnapshot {
  const running = tasks.filter((t) => t.status === "running" || t.status === "retrying").length
  const verifying = tasks.filter((t) => t.status === "verifying").length
  const passed = tasks.filter((t) => t.status === "passed").length
  const failed = tasks.filter((t) => t.status === "failed").length
  const total = tasks.length
  if (error) {
    return { phase: "error", label: error, running, verifying, passed, failed, total }
  }
  if (total === 0) return emptyStatus()
  if (passed + failed === total) {
    return {
      phase: "done",
      label: failed > 0 ? `Done ${passed}/${total} passed` : "Done",
      running,
      verifying,
      passed,
      failed,
      total,
    }
  }
  if (verifying > 0 && running === 0) {
    return { phase: "verifying", label: `Verifying ${verifying}`, running, verifying, passed, failed, total }
  }
  if (running > 0) {
    return { phase: "running", label: `Running ${running} parallel`, running, verifying, passed, failed, total }
  }
  return { phase: "planning", label: "Planning", running, verifying, passed, failed, total }
}

export function foldEvent(prev: StatusSnapshot, event: OrchestratorEvent, tasks: AgentTask[] = []): StatusSnapshot {
  switch (event.type) {
    case "planning":
      return { ...prev, phase: "planning", label: "Planning" }
    case "plan_ready":
      return statusFromTasks(event.tasks)
    case "agent_start":
      return statusFromTasks(applyTaskStatus(tasks, event.taskId, "running"))
    case "agent_verify":
      return {
        ...statusFromTasks(applyTaskStatus(tasks, event.taskId, "verifying")),
        phase: "verifying",
        label: event.pass ? `Verified ${event.taskId}` : `Retry ${event.taskId}`,
      }
    case "agent_delta":
      return { ...prev, label: `Writing ${event.taskId}` }
    case "agent_done":
      return statusFromTasks(applyTaskStatus(tasks, event.taskId, "passed"))
    case "run_complete": {
      const mapped: AgentTask[] = event.results.map((r) => ({
        id: r.taskId,
        title: r.taskId,
        instructions: "",
        dependsOn: [],
        status: r.passed ? "passed" : "failed",
      }))
      return statusFromTasks(mapped)
    }
    case "error":
      return { ...prev, phase: "error", label: event.message }
    case "usage":
      return {
        ...prev,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        calls: event.calls,
        label: withUsage(prev.label, event.inputTokens, event.outputTokens),
      }
    default:
      return prev
  }
}

function withUsage(label: string, input: number, output: number): string {
  const total = input + output
  if (total <= 0) return label
  const compact = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)
  if (label.includes("tok")) return label.replace(/\d+(\.\d+)?k? tok/, `${compact} tok`)
  return `${label} · ${compact} tok`
}

function applyTaskStatus(tasks: AgentTask[], id: string, status: AgentTask["status"]): AgentTask[] {
  if (tasks.length === 0) {
    return [{ id, title: id, instructions: "", dependsOn: [], status }]
  }
  return tasks.map((t) => (t.id === id ? { ...t, status } : t))
}

export function statusBarText(snap: StatusSnapshot): string {
  return snap.label
}
