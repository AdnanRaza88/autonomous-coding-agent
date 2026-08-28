import type { MemoryConfig } from "./config.js"
import type { AutoMemClient, GraphitiClient, ProjectContext } from "./types.js"

export async function getProjectContextFor(
  query: string,
  clients: { automem: AutoMemClient; graphiti: GraphitiClient },
  config: MemoryConfig,
): Promise<ProjectContext> {
  const q = query.trim()
  if (!q) return { relevantMemories: [], relevantKnowledgeGraphFacts: [] }

  const [memories, facts, nodes] = await Promise.all([
    safeRecall(clients.automem, q, config.recallLimit),
    safeFacts(clients.graphiti, q, config.factLimit),
    safeNodes(clients.graphiti, q, config.nodeLimit),
  ])

  const relevantMemories = uniqueSnippets(
    memories.map((m) => clip(m.content, config.maxSnippetChars)),
    config.recallLimit,
  )
  const relevantKnowledgeGraphFacts = uniqueSnippets(
    [...facts.map((f) => f.text), ...nodes.map((n) => n.text)].map((t) => clip(t, config.maxSnippetChars)),
    config.factLimit + Math.min(4, config.nodeLimit),
  )
  return { relevantMemories, relevantKnowledgeGraphFacts }
}

async function safeRecall(client: AutoMemClient, query: string, limit: number) {
  try {
    return await client.recall(query, limit)
  } catch {
    return []
  }
}

async function safeFacts(client: GraphitiClient, query: string, limit: number) {
  try {
    return await client.searchFacts(query, limit)
  } catch {
    return []
  }
}

async function safeNodes(client: GraphitiClient, query: string, limit: number) {
  try {
    return await client.searchNodes(query, limit)
  } catch {
    return []
  }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function uniqueSnippets(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.toLowerCase()
    if (!v || seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}
