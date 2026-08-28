export type SuggestedSubtask = {
  title: string
  instructions: string
}

export type NeedsSubtasksSignal = {
  type: "needs_subtasks"
  reason: string
  suggestedSubtasks: SuggestedSubtask[]
}

const SIGNAL_TYPE = "needs_subtasks" as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseSuggested(raw: unknown): SuggestedSubtask[] {
  if (!Array.isArray(raw)) return []
  const out: SuggestedSubtask[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const title = typeof item.title === "string" ? item.title.trim() : ""
    const instructions =
      typeof item.instructions === "string" ? item.instructions.trim() : ""
    if (!title && !instructions) continue
    out.push({
      title: title || "untitled",
      instructions: instructions || title || "untitled",
    })
  }
  return out
}

function tryParseObject(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {}

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {}
  }

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }

  return null
}

export function parseNeedsSubtasks(output: string): NeedsSubtasksSignal | null {
  if (typeof output !== "string" || !output.trim()) return null

  const parsed = tryParseObject(output)
  if (!isRecord(parsed)) return null
  if (parsed.type !== SIGNAL_TYPE) return null

  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "further decomposition required"

  const suggestedSubtasks = parseSuggested(parsed.suggestedSubtasks)

  return {
    type: SIGNAL_TYPE,
    reason,
    suggestedSubtasks,
  }
}

export function isNeedsSubtasks(output: string): boolean {
  return parseNeedsSubtasks(output) !== null
}

export function formatNeedsSubtasks(signal: NeedsSubtasksSignal): string {
  return JSON.stringify({
    type: SIGNAL_TYPE,
    reason: signal.reason,
    suggestedSubtasks: signal.suggestedSubtasks.map((s) => ({
      title: s.title,
      instructions: s.instructions,
    })),
  })
}
