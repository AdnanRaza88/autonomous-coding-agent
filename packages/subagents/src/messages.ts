import type { AgentTask, ChatMessage, SharedSpec } from "@agent-core/types"
import type { SubagentDefinition } from "./definitions.js"

export function formatSharedSpec(spec: SharedSpec): string {
  const lines: string[] = [
    "## Shared Project Spec",
    `Goal: ${spec.goal}`,
    `Created: ${spec.createdAt}`,
  ]

  const constraintKeys = Object.keys(spec.constraints)
  if (constraintKeys.length > 0) {
    lines.push("Constraints:")
    for (const key of constraintKeys) {
      lines.push(`- ${key}: ${spec.constraints[key]}`)
    }
  }

  if (spec.styleGuide) {
    const styleKeys = Object.keys(spec.styleGuide)
    if (styleKeys.length > 0) {
      lines.push("Style guide:")
      for (const key of styleKeys) {
        lines.push(`- ${key}: ${spec.styleGuide[key]}`)
      }
    }
  }

  return lines.join("\n")
}

export function buildSystemPrompt(
  spec: SharedSpec,
  definition?: SubagentDefinition
): string {
  const persona =
    definition?.systemPromptTemplate ??
    `You are a specialized coding subagent. Complete the assigned task fully and accurately. Follow the shared project spec without deviation. Do not invent requirements that are not present in the spec or the task instructions.`

  return `${persona}\n\n${formatSharedSpec(spec)}`
}

export function buildMessages(
  task: AgentTask,
  spec: SharedSpec,
  definition?: SubagentDefinition
): ChatMessage[] {
  const system = buildSystemPrompt(spec, definition)
  const userParts = [
    `Task id: ${task.id}`,
    `Title: ${task.title}`,
    "",
    task.instructions,
  ]

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n") },
  ]
}
