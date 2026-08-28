export type SuggestedSubtask = {
  title: string
  instructions: string
}

export type NeedsSubtasksSignal = {
  type: "needs_subtasks"
  reason: string
  suggestedSubtasks: SuggestedSubtask[]
}

const FENCE = /```(?:json)?\s*([\s\S]*?)```/gi
const DEFAULT_REASON = "further decomposition required"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readSuggested(raw: unknown): SuggestedSubtask[] {
  if (!Array.isArray(raw)) return []
  const out: SuggestedSubtask[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) continue
    const title = typeof rec.title === "string" ? rec.title.trim() : ""
    const instructions =
      typeof rec.instructions === "string"
        ? rec.instructions.trim()
        : typeof rec.description === "string"
          ? rec.description.trim()
          : ""
    if (!title || !instructions) continue
    out.push({ title, instructions })
  }
  return out
}

function flagged(obj: Record<string, unknown>): boolean {
  return (
    obj.type === "needs_subtasks" ||
    obj.needs_subtasks === true ||
    obj.needsSubtasks === true ||
    obj.signal === "needs_subtasks"
  )
}

function toSignal(obj: Record<string, unknown>): NeedsSubtasksSignal | null {
  if (!flagged(obj)) return null
  const reason =
    typeof obj.reason === "string" && obj.reason.trim()
      ? obj.reason.trim()
      : DEFAULT_REASON
  const suggestedSubtasks = readSuggested(
    obj.suggestedSubtasks ?? obj.subtasks ?? obj.proposed ?? obj.tasks
  )
  return {
    type: "needs_subtasks",
    reason,
    suggestedSubtasks,
  }
}

function tryParse(text: string): unknown | undefined {
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

function objectsNearFlags(output: string): string[] {
  const flags = ["needs_subtasks", "needsSubtasks"]
  const found: string[] = []
  for (const flag of flags) {
    let from = 0
    while (from < output.length) {
      const at = output.indexOf(flag, from)
      if (at < 0) break
      const start = output.lastIndexOf("{", at)
      if (start >= 0) {
        const slice = sliceBalancedObject(output, start)
        if (slice) found.push(slice)
      }
      from = at + flag.length
    }
  }
  return found
}

function candidates(output: string): string[] {
  const chunks: string[] = []
  const trimmed = output.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) chunks.push(trimmed)

  FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FENCE.exec(output)) !== null) {
    const inner = match[1]?.trim()
    if (inner) chunks.push(inner)
  }

  for (const slice of objectsNearFlags(output)) chunks.push(slice)
  return chunks
}

function interpret(parsed: unknown): NeedsSubtasksSignal | null {
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const rec = asRecord(item)
      if (!rec) continue
      const hit = toSignal(rec)
      if (hit) return hit
    }
    return null
  }
  const rec = asRecord(parsed)
  return rec ? toSignal(rec) : null
}

export function parseNeedsSubtasks(output: string): NeedsSubtasksSignal | null {
  if (!output || typeof output !== "string") return null
  for (const chunk of candidates(output)) {
    const parsed = tryParse(chunk)
    if (parsed === undefined) continue
    const hit = interpret(parsed)
    if (hit) return hit
  }
  return null
}

export function isNeedsSubtasks(output: string): boolean {
  return parseNeedsSubtasks(output) !== null
}

export function formatNeedsSubtasks(signal: NeedsSubtasksSignal): string {
  return JSON.stringify({
    type: "needs_subtasks",
    reason: signal.reason,
    suggestedSubtasks: signal.suggestedSubtasks.map((s) => ({
      title: s.title,
      instructions: s.instructions,
    })),
  })
}
