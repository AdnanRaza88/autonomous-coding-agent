import type { SubagentDefinition } from "../../src/definitions.js"
import { SDD_SYSTEM } from "./prompts.js"

export const SDD_DEFINITION_ID = "sdd"

export function getSddDefinition(): SubagentDefinition {
  return {
    id: SDD_DEFINITION_ID,
    name: "Spec-Driven Development",
    systemPromptTemplate: SDD_SYSTEM,
    defaultModel: "llama-3.3-70b-versatile",
    maxContextTokens: 131072,
    tools: [],
  }
}
