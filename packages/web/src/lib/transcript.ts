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

export function formatTranscript(view: RunView): string {
  const lines: string[] = []
  for (const turn of buildTranscript(view)) {
    if (turn.kind === "user") {
      lines.push("You", turn.text, "")
      continue
    }
    if (turn.kind === "status") {
      lines.push(turn.text, "")
      continue
    }
    lines.push(turn.title)
    if (turn.text) lines.push(turn.text)
    if (turn.note) lines.push(turn.note)
    lines.push("")
  }
  return lines.join("\n").trim()
}

const FOLLOW_CAP = 6000

export function composeFollowUpGoal(view: RunView, message: string): string {
  const next = message.trim()
  const prior = priorWork(view)
  if (!view.goal || view.phase === "idle") return next
  const chunks = [`Follow-up on a prior run.`, `Original goal:`, seedGoal(view.goal)]
  if (prior) chunks.push(`What already shipped:`, prior)
  chunks.push(`New request:`, next)
  return chunks.join("\n")
}

export function seedGoal(goal: string): string {
  let current = goal.trim()
  for (let i = 0; i < 8; i += 1) {
    const idx = current.indexOf("Original goal:")
    if (idx < 0) return current
    const rest = current.slice(idx + "Original goal:".length).trim()
    const cut = rest.search(/\nWhat already shipped:|\nNew request:/)
    current = (cut >= 0 ? rest.slice(0, cut) : rest).trim()
  }
  return current
}

function priorWork(view: RunView): string {
  const parts: string[] = []
  for (const task of view.tasks) {
    const body = (view.drafts[task.id] ?? "").trim()
    if (!body) continue
    const clipped = body.length > 800 ? `${body.slice(0, 800)}…` : body
    parts.push(`${task.title} (${task.status}): ${clipped}`)
  }
  const joined = parts.join("\n\n")
  if (joined.length <= FOLLOW_CAP) return joined
  return `${joined.slice(0, FOLLOW_CAP)}…`
}

export function isLivePhase(phase: RunView["phase"]): boolean {
  return phase === "planning" || phase === "running"
}

export function isSettledPhase(phase: RunView["phase"]): boolean {
  return phase === "complete" || phase === "error" || phase === "cancelled"
}
