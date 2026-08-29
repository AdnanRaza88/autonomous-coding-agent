export interface SubagentDefinition {
  id: string
  name: string
  systemPromptTemplate: string
  defaultModel: string
  maxContextTokens: number
  tools: string[]
}

const registry = new Map<string, SubagentDefinition>()

export function registerSubagentDefinition(def: SubagentDefinition): void {
  if (!def.id || typeof def.id !== "string") {
    throw new Error("SubagentDefinition.id must be a non-empty string")
  }
  if (!def.name || typeof def.name !== "string") {
    throw new Error("SubagentDefinition.name must be a non-empty string")
  }
  if (typeof def.systemPromptTemplate !== "string") {
    throw new Error("SubagentDefinition.systemPromptTemplate must be a string")
  }
  if (!def.defaultModel || typeof def.defaultModel !== "string") {
    throw new Error("SubagentDefinition.defaultModel must be a non-empty string")
  }
  if (typeof def.maxContextTokens !== "number" || def.maxContextTokens <= 0) {
    throw new Error("SubagentDefinition.maxContextTokens must be a positive number")
  }
  if (!Array.isArray(def.tools)) {
    throw new Error("SubagentDefinition.tools must be an array")
  }

  registry.set(def.id, {
    id: def.id,
    name: def.name,
    systemPromptTemplate: def.systemPromptTemplate,
    defaultModel: def.defaultModel,
    maxContextTokens: def.maxContextTokens,
    tools: [...def.tools],
  })
}

export function listSubagentDefinitions(): SubagentDefinition[] {
  return Array.from(registry.values()).map((d) => ({
    id: d.id,
    name: d.name,
    systemPromptTemplate: d.systemPromptTemplate,
    defaultModel: d.defaultModel,
    maxContextTokens: d.maxContextTokens,
    tools: [...d.tools],
  }))
}

export function getSubagentDefinition(id: string): SubagentDefinition | undefined {
  const d = registry.get(id)
  if (!d) return undefined
  return {
    id: d.id,
    name: d.name,
    systemPromptTemplate: d.systemPromptTemplate,
    defaultModel: d.defaultModel,
    maxContextTokens: d.maxContextTokens,
    tools: [...d.tools],
  }
}

export function clearSubagentDefinitions(): void {
  registry.clear()
}
