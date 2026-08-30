import type { AgentTask } from "@agent-core/types"
import type { RunView } from "../state/events"

export type TranscriptTurn =
  | { kind: "user"; text: string }
  | { kind: "status"; text: string }
  | {
      kind: "agent"
      taskId: string
      title: string
      text: string
      live: boolean
      note?: string
      status: AgentTask["status"] | "queued"
    }

export function buildTranscript(view: RunView): TranscriptTurn[] {
  const turns: TranscriptTurn[] = []
  if (view.goal) turns.push({ kind: "user", text: view.goal })

  if (view.phase === "planning" && view.tasks.length === 0) {
    turns.push({ kind: "status", text: "Planning the work." })
  }

  for (const task of view.tasks) {
    const text = view.drafts[task.id] ?? ""
    const live = task.status === "running" || task.status === "verifying" || task.status === "retrying"
    if (!text && task.status === "queued") continue
    turns.push({
      kind: "agent",
      taskId: task.id,
      title: task.title,
      text,
      live,
      note: view.notes[task.id],
      status: task.status,
    })
  }

  if (view.phase === "cancelled") {
    turns.push({ kind: "status", text: view.error ? `Cancelled: ${view.error}` : "Cancelled." })
  } else if (view.phase === "error") {
    turns.push({ kind: "status", text: view.error ?? "Run failed." })
  } else if (view.phase === "complete") {
    turns.push({ kind: "status", text: completeLine(view) })
  }

  return turns
}

function completeLine(view: RunView): string {
  const passed = view.results.filter((r) => r.passed).length
  const total = view.results.length || view.tasks.length
  if (!total) return "Run complete."
  return `Run complete. ${passed} of ${total} tasks passed.`
}
