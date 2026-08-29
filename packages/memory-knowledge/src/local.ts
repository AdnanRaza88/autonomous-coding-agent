import type { AutoMemClient, GraphFact, GraphitiClient, StoredMemory } from "./types.js"

interface LocalMemory extends StoredMemory {}

export function createLocalAutoMem(): AutoMemClient & { dump(): StoredMemory[] } {
  const items: LocalMemory[] = []
  return {
    async store(input) {
      const rec: LocalMemory = {
        id: `mem_${items.length + 1}`,
        content: input.content,
        type: input.type,
        tags: input.tags ?? [],
        importance: input.importance ?? 0.7,
        metadata: input.metadata ?? {},
        createdAt: new Date().toISOString(),
      }
      items.push(rec)
      return { id: rec.id }
    },
    async recall(query, limit) {
      return rankText(
        items,
        query,
        (m) => `${m.content} ${m.tags.join(" ")} ${m.type ?? ""}`,
        limit,
      )
    },
    async health() {
      return true
    },
    dump() {
      return items.slice()
    },
  }
}

export function createLocalGraphiti(groupId = "agent-core"): GraphitiClient & {
  dump(): GraphFact[]
} {
  const facts: GraphFact[] = []
  return {
    async addEpisode(input) {
      const rec: GraphFact = {
        id: `ep_${facts.length + 1}`,
        text: input.body,
        source: input.sourceDescription ?? input.name,
        kind: input.source === "json" ? "episode" : "episode",
        groupId: input.groupId ?? groupId,
        createdAt: new Date().toISOString(),
      }
      facts.push(rec)
      extractStatements(input.body).forEach((line, i) => {
        facts.push({
          id: `${rec.id}_f${i + 1}`,
          text: line,
          source: input.name,
          kind: "fact",
          groupId: rec.groupId,
          createdAt: rec.createdAt,
        })
      })
      return { id: rec.id }
    },
    async searchFacts(query, limit) {
      return rankText(
        facts.filter((f) => f.kind === "fact" || f.kind === "edit"),
        query,
        (f) => f.text,
        limit,
      )
    },
    async searchNodes(query, limit) {
      return rankText(facts, query, (f) => f.text, limit)
    },
    async listRecent(limit) {
      return facts.filter((f) => f.kind === "episode").slice(-limit).reverse()
    },
    async health() {
      return true
    },
    dump() {
      return facts.slice()
    },
  }
}

export function rankText<T>(items: T[], query: string, textOf: (item: T) => string, limit: number): T[] {
  const terms = tokenize(query)
  if (terms.length === 0) return items.slice(-limit).reverse()
  const scored = items.map((item) => {
    const hay = tokenize(textOf(item))
    let score = 0
    for (const term of terms) {
      if (hay.includes(term)) score += 2
      else if (hay.some((h) => h.includes(term) || term.includes(h))) score += 1
    }
    return { item, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.item)
}

function extractStatements(body: string): string[] {
  const lines = body
    .split(/\n+/)
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l.length > 12 && l.length < 400)
  if (lines.length > 0) return lines.slice(0, 12)
  return body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 8)
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1)
}
