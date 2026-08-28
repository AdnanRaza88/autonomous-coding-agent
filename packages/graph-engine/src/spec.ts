import type { ChatMessage, ProviderAdapter, ProviderConfig, SharedSpec } from "@agent-core/types"
import { asString, asStringMap, extractJson, isRecord } from "./json.js"

const SYSTEM = `You write a SharedSpec for a coding-agent run.
Return JSON only, no prose, with this shape:
{
  "goal": "one-sentence restatement of the user goal",
  "constraints": { "key": "value" },
  "styleGuide": { "key": "value" }
}
Rules:
- Capture every hard constraint the user stated.
- Put visual, tone, naming, and theme decisions in styleGuide so parallel workers cannot diverge.
- Invent nothing the user did not imply. Empty objects are fine.
- Keep values short and concrete.`

export async function generateSpec(
  userGoal: string,
  config: ProviderConfig,
  chat: (config: ProviderConfig, messages: ChatMessage[]) => Promise<string>
): Promise<SharedSpec> {
  const createdAt = new Date().toISOString()
  const fallback = fallbackSpec(userGoal, createdAt)
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userGoal },
  ]
  let raw: string
  try {
    raw = await chat(config, messages)
  } catch {
    return fallback
  }
  const parsed = extractJson(raw)
  if (!isRecord(parsed)) return fallback
  const goal = asString(parsed.goal, userGoal).trim() || userGoal
  const constraints = asStringMap(parsed.constraints)
  const styleGuide = parsed.styleGuide ? asStringMap(parsed.styleGuide) : undefined
  const spec: SharedSpec = { goal, constraints, createdAt }
  if (styleGuide && Object.keys(styleGuide).length > 0) spec.styleGuide = styleGuide
  return spec
}

export function fallbackSpec(userGoal: string, createdAt: string): SharedSpec {
  const constraints: Record<string, string> = {}
  const styleGuide: Record<string, string> = {}
  pullPairs(userGoal, constraints, styleGuide)
  const spec: SharedSpec = { goal: userGoal.trim(), constraints, createdAt }
  if (Object.keys(styleGuide).length > 0) spec.styleGuide = styleGuide
  return spec
}

export function freezeSpec(spec: SharedSpec): SharedSpec {
  const frozen: SharedSpec = {
    goal: spec.goal,
    constraints: Object.freeze({ ...spec.constraints }),
    createdAt: spec.createdAt,
  }
  if (spec.styleGuide) frozen.styleGuide = Object.freeze({ ...spec.styleGuide })
  return Object.freeze(frozen)
}

export function chatViaAdapter(
  adapter: ProviderAdapter
): (config: ProviderConfig, messages: ChatMessage[]) => Promise<string> {
  return (config, messages) => adapter.chat(config, messages)
}

function pullPairs(
  goal: string,
  constraints: Record<string, string>,
  styleGuide: Record<string, string>
): void {
  const lower = goal.toLowerCase()
  if (/\btypescript\b/.test(lower)) constraints.language = "TypeScript"
  if (/\bpython\b/.test(lower)) constraints.language = "Python"
  if (/\bno\s+tests?\b/.test(lower)) constraints.tests = "none"
  if (/\bwith tests?\b/.test(lower)) constraints.tests = "required"
  const theme = goal.match(/\b(dark|light|night|day)\s+(theme|mode|sky)\b/i)
  if (theme) styleGuide.theme = theme[0].toLowerCase()
  const color = goal.match(/\b(blue|green|red|amber|slate|neutral)\b/i)
  if (color) styleGuide.accent = color[1].toLowerCase()
}
