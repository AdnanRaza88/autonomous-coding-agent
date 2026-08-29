export interface AutoMemConfig {
  baseUrl: string
  token?: string
  timeoutMs: number
}

export interface GraphitiConfig {
  baseUrl: string
  groupId: string
  timeoutMs: number
}

export interface MemoryConfig {
  automem: AutoMemConfig
  graphiti: GraphitiConfig
  recallLimit: number
  factLimit: number
  nodeLimit: number
  maxSnippetChars: number
}

export function defaultMemoryConfig(overrides?: Partial<{
  automemUrl: string
  automemToken: string
  graphitiUrl: string
  groupId: string
  recallLimit: number
  factLimit: number
  nodeLimit: number
  maxSnippetChars: number
  timeoutMs: number
}>): MemoryConfig {
  const timeoutMs = overrides?.timeoutMs ?? 8_000
  return {
    automem: {
      baseUrl: trimSlash(overrides?.automemUrl ?? process.env.AUTOMEM_API_URL ?? "http://127.0.0.1:8000"),
      token: overrides?.automemToken ?? process.env.AUTOMEM_API_TOKEN,
      timeoutMs,
    },
    graphiti: {
      baseUrl: trimSlash(overrides?.graphitiUrl ?? process.env.GRAPHITI_API_URL ?? "http://127.0.0.1:8001"),
      groupId: overrides?.groupId ?? process.env.GRAPHITI_GROUP_ID ?? "agent-core",
      timeoutMs,
    },
    recallLimit: overrides?.recallLimit ?? 8,
    factLimit: overrides?.factLimit ?? 8,
    nodeLimit: overrides?.nodeLimit ?? 6,
    maxSnippetChars: overrides?.maxSnippetChars ?? 900,
  }
}

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, "")
}
