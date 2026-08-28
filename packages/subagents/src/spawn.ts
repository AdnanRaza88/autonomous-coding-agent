export type ProposedSubtask = {
  title: string
  instructions: string
}

export type SpawnRequest = {
  parentTaskId: string
  reason: string
  proposed: ProposedSubtask[]
}

const FENCE = /```(?:json)?\s*([\s\S]*?)```/gi

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readProposed(raw: unknown): ProposedSubtask[] {
  if (!Array.isArray(raw)) return []
  const out: ProposedSubtask[] = []
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

function interpretObject(obj: Record<string, unknown>, parentTaskId: string): SpawnRequest | null {
  const flagged =
    obj.needs_subtasks === true ||
    obj.needsSubtasks === true ||
    obj.signal === "needs_subtasks"

  if (!flagged) return null

  const proposed = readProposed(obj.subtasks ?? obj.proposed ?? obj.tasks)
  const reason =
    typeof obj.reason === "string" && obj.reason.trim()
      ? obj.reason.trim()
      : typeof obj.message === "string" && obj.message.trim()
        ? obj.message.trim()
        : "Task requires further decomposition"

  return {
    parentTaskId,
    reason,
    proposed,
  }
}

function tryParseJson(text: string): unknown | undefined {
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

function collectCandidates(output: string): string[] {
  const chunks: string[] = []
  const trimmed = output.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    chunks.push(trimmed)
  }

  FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FENCE.exec(output)) !== null) {
    const inner = match[1]?.trim()
    if (inner) chunks.push(inner)
  }

  for (const slice of objectsNearFlags(output)) {
    chunks.push(slice)
  }

  return chunks
}

export function parseSpawnSignal(output: string, parentTaskId: string): SpawnRequest | null {
  if (!output || typeof output !== "string") return null

  for (const chunk of collectCandidates(output)) {
    const parsed = tryParseJson(chunk)
    if (parsed === undefined) continue
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const rec = asRecord(item)
        if (!rec) continue
        const hit = interpretObject(rec, parentTaskId)
        if (hit) return hit
      }
      continue
    }
    const rec = asRecord(parsed)
    if (!rec) continue
    const hit = interpretObject(rec, parentTaskId)
    if (hit) return hit
  }

  return null
}

export function spawnSystemHint(): string {
  return [
    "If the assigned work cannot be completed as a single unit, do not invent a partial solution.",
    "Instead return only a JSON object of this exact shape and nothing else:",
    '{"needs_subtasks":true,"reason":"short explanation","subtasks":[{"title":"...","instructions":"..."}]}',
    "The orchestrator will re-plan that branch. Do not attempt to spawn or run child agents yourself.",
  ].join(" ")
}
