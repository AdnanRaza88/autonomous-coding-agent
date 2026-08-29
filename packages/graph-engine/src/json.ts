export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const parsed = tryParse(candidate)
  if (parsed !== undefined) return parsed
  const start = findObjectStart(candidate)
  if (start < 0) return undefined
  const sliced = sliceBalanced(candidate, start)
  if (!sliced) return undefined
  return tryParse(sliced)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return fallback
}

export function asStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v)
  }
  return out
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function findObjectStart(text: string): number {
  const obj = text.indexOf("{")
  const arr = text.indexOf("[")
  if (obj < 0) return arr
  if (arr < 0) return obj
  return Math.min(obj, arr)
}

function sliceBalanced(text: string, start: number): string | null {
  const open = text[start]
  const close = open === "{" ? "}" : open === "[" ? "]" : null
  if (!close) return null
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
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
