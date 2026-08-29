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
      typeof item.instructions === "string"
        ? item.instructions.trim()
        : typeof item.description === "string"
          ? item.description.trim()
          : ""
    if (!title && !instructions) continue
    out.push({
      title: title || "untitled",
      instructions: instructions || title || "untitled",
    })
  }
  return out
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function sliceBalancedObject(text: string, start: number): string | null {
  if (text[start] !== "{") return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) {
        esc = false
        continue
      }
      if (c === "\\") {
        esc = true
        continue
      }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === "{") depth += 1
    else if (c === "}") {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function collectCandidates(output: string): string[] {
  const chunks: string[] = []
  const trimmed = output.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    chunks.push(trimmed)
  }

  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = fence.exec(output)) !== null) {
    const inner = match[1]?.trim()
    if (inner) chunks.push(inner)
  }

  for (const flag of ["needs_subtasks", "needsSubtasks"]) {
    let from = 0
    while (from < output.length) {
      const at = output.indexOf(flag, from)
      if (at < 0) break
      const start = output.lastIndexOf("{", at)
      if (start >= 0) {
        const slice = sliceBalancedObject(output, start)
        if (slice) chunks.push(slice)
      }
      from = at + flag.length
    }
  }

  return chunks
}

function toSignal(obj: Record<string, unknown>): NeedsSubtasksSignal | null {
  const typed =
    obj.type === SIGNAL_TYPE ||
    obj.needs_subtasks === true ||
    obj.needsSubtasks === true ||
    obj.signal === SIGNAL_TYPE

  if (!typed) return null

  const reason =
    typeof obj.reason === "string" && obj.reason.trim()
      ? obj.reason.trim()
      : typeof obj.message === "string" && obj.message.trim()
        ? obj.message.trim()
        : "further decomposition required"

  const suggestedSubtasks = parseSuggested(
    obj.suggestedSubtasks ?? obj.subtasks ?? obj.proposed ?? obj.tasks
  )

  return {
    type: SIGNAL_TYPE,
    reason,
    suggestedSubtasks,
  }
}

export function parseNeedsSubtasks(output: string): NeedsSubtasksSignal | null {
  if (typeof output !== "string" || !output.trim()) return null

  for (const chunk of collectCandidates(output)) {
    const parsed = tryParseJson(chunk)
    if (parsed === undefined) continue
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!isRecord(item)) continue
        const hit = toSignal(item)
        if (hit) return hit
      }
      continue
    }
    if (!isRecord(parsed)) continue
    const hit = toSignal(parsed)
    if (hit) return hit
  }

  return null
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
