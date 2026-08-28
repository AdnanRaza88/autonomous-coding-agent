import type { AgentTask, ChatMessage, SharedSpec } from "@agent-core/types"
import type { SubagentDefinition } from "./definitions.js"
import { buildSystemPrompt } from "./messages.js"

export const BABY_MAX_CONTEXT_TOKENS = 100_000
export const BABY_OUTPUT_RESERVE_TOKENS = 2_048

const TRUNCATION_MARK = "\n\n[truncated to fit context budget]"

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateMessageTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += 4
    total += estimateTokens(m.role)
    total += estimateTokens(m.content)
  }
  return total
}

function clip(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return ""
  const budget = maxTokens * 4
  if (text.length <= budget) return text
  const keep = Math.max(0, budget - TRUNCATION_MARK.length)
  return text.slice(0, keep) + TRUNCATION_MARK
}

function compactConstraints(
  constraints: Record<string, string>,
  maxTokens: number
): Record<string, string> {
  const keys = Object.keys(constraints)
  const out: Record<string, string> = {}
  let used = 0
  for (const key of keys) {
    const raw = `${key}: ${constraints[key]}`
    const cost = estimateTokens(raw) + 2
    if (used + cost > maxTokens) {
      const remain = maxTokens - used
      if (remain > 8) {
        out[key] = clip(constraints[key], remain - estimateTokens(key) - 2)
      }
      break
    }
    out[key] = constraints[key]
    used += cost
  }
  return out
}

export type BudgetFit = {
  spec: SharedSpec
  task: AgentTask
  messages: ChatMessage[]
  tokens: number
  truncated: boolean
}

export function fitToTokenBudget(
  task: AgentTask,
  spec: SharedSpec,
  definition: SubagentDefinition | undefined,
  maxTokens: number,
  reserveTokens = BABY_OUTPUT_RESERVE_TOKENS
): BudgetFit {
  const cap = Math.max(256, maxTokens - reserveTokens)
  const originalMessages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(spec, definition) },
    {
      role: "user",
      content: [`Task id: ${task.id}`, `Title: ${task.title}`, "", task.instructions].join("\n"),
    },
  ]

  if (estimateMessageTokens(originalMessages) <= cap) {
    return {
      spec,
      task,
      messages: originalMessages,
      tokens: estimateMessageTokens(originalMessages),
      truncated: false,
    }
  }

  const persona =
    definition?.systemPromptTemplate ??
    "You are a specialized coding subagent. Complete the assigned task fully and accurately. Follow the shared project spec without deviation."

  let workingSpec: SharedSpec = {
    goal: spec.goal,
    constraints: { ...spec.constraints },
    styleGuide: spec.styleGuide ? { ...spec.styleGuide } : undefined,
    createdAt: spec.createdAt,
  }

  let instructions = task.instructions
  let truncated = false

  const build = (): ChatMessage[] => {
    const system = `${persona}\n\n## Shared Project Spec\nGoal: ${workingSpec.goal}\nCreated: ${workingSpec.createdAt}${formatMap(
      "Constraints",
      workingSpec.constraints
    )}${formatMap("Style guide", workingSpec.styleGuide)}`
    const user = [`Task id: ${task.id}`, `Title: ${task.title}`, "", instructions].join("\n")
    return [
      { role: "system", content: system },
      { role: "user", content: user },
    ]
  }

  let messages = build()
  if (estimateMessageTokens(messages) > cap && workingSpec.styleGuide) {
    workingSpec = { ...workingSpec, styleGuide: undefined }
    truncated = true
    messages = build()
  }

  if (estimateMessageTokens(messages) > cap) {
    const constraintBudget = Math.max(
      32,
      Math.floor(cap * 0.15) - estimateTokens(workingSpec.goal) - 20
    )
    workingSpec = {
      ...workingSpec,
      constraints: compactConstraints(workingSpec.constraints, constraintBudget),
    }
    truncated = true
    messages = build()
  }

  if (estimateMessageTokens(messages) > cap) {
    const goalBudget = Math.max(24, Math.floor(cap * 0.08))
    if (estimateTokens(workingSpec.goal) > goalBudget) {
      workingSpec = { ...workingSpec, goal: clip(workingSpec.goal, goalBudget) }
      truncated = true
      messages = build()
    }
  }

  messages = build()
  let used = estimateMessageTokens(messages)
  if (used > cap) {
    const overhead = used - estimateTokens(instructions)
    const instructionBudget = Math.max(64, cap - overhead)
    if (estimateTokens(instructions) > instructionBudget) {
      instructions = clip(instructions, instructionBudget)
      truncated = true
      messages = build()
      used = estimateMessageTokens(messages)
    }
  }

  if (estimateMessageTokens(messages) > cap) {
    const systemBudget = Math.max(80, Math.floor(cap * 0.45))
    const userBudget = Math.max(80, cap - systemBudget)
    messages = [
      { role: "system", content: clip(messages[0].content, systemBudget) },
      { role: "user", content: clip(messages[1].content, userBudget) },
    ]
    truncated = true
  }

  const tokens = estimateMessageTokens(messages)
  if (tokens > cap) {
    const hard = Math.max(32, cap - 8)
    const joined = messages.map((m) => m.content).join("\n")
    const clipped = clip(joined, hard)
    messages = [
      { role: "system", content: clipped.slice(0, Math.floor(clipped.length / 2)) },
      { role: "user", content: clipped.slice(Math.floor(clipped.length / 2)) },
    ]
    truncated = true
  }

  const fittedTask: AgentTask = {
    id: task.id,
    title: task.title,
    instructions,
    dependsOn: [...task.dependsOn],
    assignedModel: task.assignedModel,
    status: task.status,
  }

  return {
    spec: workingSpec,
    task: fittedTask,
    messages,
    tokens: estimateMessageTokens(messages),
    truncated,
  }
}

function formatMap(label: string, map?: Record<string, string>): string {
  if (!map) return ""
  const keys = Object.keys(map)
  if (keys.length === 0) return ""
  const lines = [`\n${label}:`]
  for (const key of keys) {
    lines.push(`- ${key}: ${map[key]}`)
  }
  return lines.join("\n")
}
