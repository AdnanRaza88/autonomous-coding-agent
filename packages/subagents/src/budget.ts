import type { AgentTask, SharedSpec } from "@agent-core/types"

export const BABY_CONTEXT_BUDGET = 100_000

const CHARS_PER_TOKEN = 4
const RESERVE_FOR_PERSONA_AND_WRAPPER = 2_000

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function hardTruncate(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return ""
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  if (maxChars <= 20) return text.slice(0, maxChars)
  return text.slice(0, maxChars - 14) + "\n...[truncated]"
}

export type BudgetFit = {
  spec: SharedSpec
  task: AgentTask
  estimatedTokens: number
}

export function fitToBabyBudget(
  task: AgentTask,
  spec: SharedSpec,
  budget: number = BABY_CONTEXT_BUDGET
): BudgetFit {
  const usable = Math.max(budget - RESERVE_FOR_PERSONA_AND_WRAPPER, 1_000)

  const goalBudget = Math.floor(usable * 0.15)
  const constraintsBudget = Math.floor(usable * 0.15)
  const styleBudget = Math.floor(usable * 0.1)
  const titleBudget = Math.floor(usable * 0.05)
  const instructionsBudget =
    usable - goalBudget - constraintsBudget - styleBudget - titleBudget

  const goal = hardTruncate(spec.goal, goalBudget)

  const constraintEntries = Object.entries(spec.constraints)
  const constraints: Record<string, string> = {}
  let constraintTokensUsed = 0
  for (const [k, v] of constraintEntries) {
    const piece = `${k}: ${v}`
    const cost = estimateTokens(piece) + 2
    if (constraintTokensUsed + cost > constraintsBudget) break
    constraints[k] = v
    constraintTokensUsed += cost
  }

  let styleGuide: Record<string, string> | undefined
  if (spec.styleGuide) {
    styleGuide = {}
    let styleTokensUsed = 0
    for (const [k, v] of Object.entries(spec.styleGuide)) {
      const piece = `${k}: ${v}`
      const cost = estimateTokens(piece) + 2
      if (styleTokensUsed + cost > styleBudget) break
      styleGuide[k] = v
      styleTokensUsed += cost
    }
    if (Object.keys(styleGuide).length === 0) styleGuide = undefined
  }

  const title = hardTruncate(task.title, titleBudget)
  const instructions = hardTruncate(task.instructions, instructionsBudget)

  const fittedSpec: SharedSpec = {
    goal,
    constraints,
    createdAt: spec.createdAt,
  }
  if (styleGuide) fittedSpec.styleGuide = styleGuide

  const fittedTask: AgentTask = {
    id: task.id,
    title,
    instructions,
    dependsOn: [...task.dependsOn],
    status: task.status,
  }
  if (task.assignedModel !== undefined) {
    fittedTask.assignedModel = task.assignedModel
  }

  const estimated =
    estimateTokens(goal) +
    estimateTokens(JSON.stringify(constraints)) +
    estimateTokens(styleGuide ? JSON.stringify(styleGuide) : "") +
    estimateTokens(title) +
    estimateTokens(instructions) +
    RESERVE_FOR_PERSONA_AND_WRAPPER

  return {
    spec: fittedSpec,
    task: fittedTask,
    estimatedTokens: Math.min(estimated, budget),
  }
}
