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

  const firstBrace = output.indexOf("{")
  const lastBrace = output.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    chunks.push(output.slice(firstBrace, lastBrace + 1))
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
