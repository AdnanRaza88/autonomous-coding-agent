import type { GraphFact, GraphitiClient } from "./types.js"

export interface UserFactEdit {
  statement: string
  replaces?: string
  note?: string
}

export async function applyUserFactEdit(
  client: GraphitiClient,
  edit: UserFactEdit,
): Promise<{ id: string }> {
  const statement = edit.statement.trim()
  if (!statement) throw new Error("fact statement is empty")
  const payload = {
    kind: "user_edit",
    statement,
    replaces: edit.replaces ?? null,
    note: edit.note ?? null,
    editedAt: new Date().toISOString(),
  }
  return client.addEpisode({
    name: "user-fact-edit",
    body: JSON.stringify(payload),
    source: "json",
    sourceDescription: "user-edit",
  })
}

export async function listGraphFacts(
  client: GraphitiClient,
  query: string,
  limit = 20,
): Promise<GraphFact[]> {
  const q = query.trim()
  if (!q) return client.listRecent(limit)
  const [facts, nodes] = await Promise.all([
    client.searchFacts(q, limit),
    client.searchNodes(q, Math.min(8, limit)),
  ])
  const seen = new Set<string>()
  const merged: GraphFact[] = []
  for (const item of [...facts, ...nodes]) {
    if (seen.has(item.id) || seen.has(item.text)) continue
    seen.add(item.id)
    seen.add(item.text)
    merged.push(item)
    if (merged.length >= limit) break
  }
  return merged
}
