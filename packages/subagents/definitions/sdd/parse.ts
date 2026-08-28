import type { AgentTask, SharedSpec } from "@agent-core/types"

export type SddStage = "constitution" | "spec" | "plan" | "tasks" | "analyze"

export type OpenQuestion = {
  id: string
  text: string
  stage: SddStage
}

const FENCE = /```(?:markdown|md|shared-spec|json)?\s*([\s\S]*?)```/i

export function unwrapFence(raw: string): string {
  const trimmed = raw.trim()
  const m = trimmed.match(/^```(?:markdown|md|shared-spec|json)?\s*([\s\S]*?)```$/i)
  if (m?.[1]) return m[1].trim()
  return trimmed
}

export function extractSharedSpec(plan: string, fallbackGoal: string, createdAt: string): SharedSpec {
  const block = extractLabeledFence(plan, "shared-spec") ?? extractLabeledFence(plan, "json")
  if (block) {
    const parsed = tryParseJson(block)
    if (isRecord(parsed)) {
      const goal =
        typeof parsed.goal === "string" && parsed.goal.trim()
          ? parsed.goal.trim()
          : fallbackGoal
      const constraints = toStringMap(parsed.constraints)
      const styleGuide = parsed.styleGuide ? toStringMap(parsed.styleGuide) : undefined
      const spec: SharedSpec = {
        goal,
        constraints,
        createdAt,
      }
      if (styleGuide && Object.keys(styleGuide).length > 0) spec.styleGuide = styleGuide
      return spec
    }
  }

  return {
    goal: fallbackGoal,
    constraints: extractConstraintsFromProse(plan),
    createdAt,
  }
}

export function extractOpenQuestions(doc: string, stage: SddStage): OpenQuestion[] {
  const questions: OpenQuestion[] = []
  const section = sliceSection(doc, /open questions?/i)
  const source = section ?? doc

  const numbered = source.matchAll(/^(?:#{1,6}\s*)?(?:[-*]\s*)?(?:Q?\d+[.)]|[-*])\s+(.+)$/gim)
  for (const m of numbered) {
    const text = (m[1] ?? "").trim()
    if (!text) continue
    if (!section && !looksLikeQuestion(text)) continue
    questions.push({
      id: `q${questions.length + 1}`,
      text,
      stage,
    })
  }

  if (questions.length === 0) {
    for (const line of source.split("\n")) {
      const t = line.trim()
      if (looksLikeQuestion(t) && t.length > 8) {
        questions.push({
          id: `q${questions.length + 1}`,
          text: t.replace(/^[-*]\s+/, ""),
          stage,
        })
      }
    }
  }

  return dedupeQuestions(questions)
}

export function parseTasksMarkdown(tasksMd: string): AgentTask[] {
  const text = unwrapFence(tasksMd)
  const blocks = splitTaskBlocks(text)
  const tasks: AgentTask[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const heading = block.heading
    const body = block.body
    const id = extractTaskId(heading, body, i)
    const title = extractTitle(heading, body, id)
    const instructions = extractInstructions(body, title)
    const dependsOn = extractDependsOn(body)

    tasks.push({
      id,
      title,
      instructions,
      dependsOn,
      status: "queued",
    })
  }

  return tasks
}

export function goalLooksAmbiguous(goal: string): boolean {
  const g = goal.trim()
  if (g.length < 12) return true
  const vague = /^(build|make|create|write|add)\s+(an?\s+)?(app|application|system|tool|thing|project|website|game)\.?$/i
  if (vague.test(g)) return true
  const wordCount = g.split(/\s+/).filter(Boolean).length
  return wordCount < 4
}

function extractLabeledFence(text: string, label: string): string | null {
  const re = new RegExp("```" + label + "\\s*([\\s\\S]*?)```", "i")
  const m = text.match(re)
  if (m?.[1]) return m[1].trim()
  if (label === "json") {
    const any = text.match(FENCE)
    if (any?.[1]?.trim().startsWith("{")) return any[1].trim()
  }
  return null
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf("{")
    if (start < 0) return undefined
    const sliced = sliceBalanced(text, start)
    if (!sliced) return undefined
    try {
      return JSON.parse(sliced)
    } catch {
      return undefined
    }
  }
}

function sliceBalanced(text: string, start: number): string | null {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v)
  }
  return out
}

function extractConstraintsFromProse(plan: string): Record<string, string> {
  const out: Record<string, string> = {}
  const section = sliceSection(plan, /constraints?|principles|rules/i)
  if (!section) return out
  for (const line of section.split("\n")) {
    const m = line.match(/^[-*]\s+\*?\*?([^:]+)\*?\*?\s*:\s*(.+)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

function sliceSection(doc: string, heading: RegExp): string | null {
  const lines = doc.split("\n")
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,6}\s+/.test(line) && heading.test(line.replace(/^#{1,6}\s+/, ""))) {
      start = i + 1
      break
    }
  }
  if (start < 0) return null
  const collected: string[] = []
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i])) break
    collected.push(lines[i])
  }
  return collected.join("\n").trim() || null
}

function looksLikeQuestion(text: string): boolean {
  return /\?/.test(text) || /^(what|which|should|do we|is the|are we|how many|where|who)\b/i.test(text)
}

function dedupeQuestions(items: OpenQuestion[]): OpenQuestion[] {
  const seen = new Set<string>()
  const out: OpenQuestion[] = []
  for (const q of items) {
    const key = q.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

function splitTaskBlocks(text: string): { heading: string; body: string }[] {
  const lines = text.split("\n")
  const blocks: { heading: string; body: string }[] = []
  let current: { heading: string; body: string[] } | null = null

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.+)$/)
    const listTask = line.match(/^[-*]\s+(?:id:\s*)?(t\d+)\b/i)
    if (heading) {
      if (current) blocks.push({ heading: current.heading, body: current.body.join("\n") })
      current = { heading: heading[1].trim(), body: [] }
      continue
    }
    if (!current && listTask) {
      current = { heading: listTask[1], body: [line] }
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) blocks.push({ heading: current.heading, body: current.body.join("\n") })

  if (blocks.length === 0 && /t\d+/i.test(text)) {
    blocks.push({ heading: "t1", body: text })
  }
  return blocks
}

function extractTaskId(heading: string, body: string, index: number): string {
  const fromHeading = heading.match(/\b(t\d+)\b/i)
  if (fromHeading) return fromHeading[1].toLowerCase()
  const fromBody = body.match(/\bid:\s*(t\d+)/i)
  if (fromBody) return fromBody[1].toLowerCase()
  return `t${index + 1}`
}

function extractTitle(heading: string, body: string, id: string): string {
  const cleaned = heading.replace(new RegExp("^" + id + "\\s*[\u2014:\\-]\\s*", "i"), "").trim()
  if (cleaned && cleaned.toLowerCase() !== id) return cleaned
  const line = body.match(/title:\s*(.+)/i)
  if (line) return line[1].trim()
  return id
}

function extractInstructions(body: string, title: string): string {
  const instr = body.match(/instructions:\s*([\s\S]+?)(?:\n\s*-(?: output| doNotTouch| dependsOn| tracesTo)|$)/i)
  if (instr) return instr[1].trim()
  const trimmed = body.trim()
  if (trimmed) return trimmed
  return title
}

function extractDependsOn(body: string): string[] {
  const line = body.match(/dependsOn:\s*(.+)/i)
  if (!line) return []
  const raw = line[1].trim().toLowerCase()
  if (!raw || raw === "none" || raw === "-" || raw === "n/a") return []
  return raw
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter((s) => /^t\d+$/i.test(s))
    .map((s) => s.toLowerCase())
}
