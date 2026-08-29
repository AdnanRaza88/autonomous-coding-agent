import type { GraphitiClient, SddDocuments } from "./types.js"

const DOCS: Array<{ key: keyof SddDocuments; name: string; source: string }> = [
  { key: "constitution", name: "constitution.md", source: "sdd-constitution" },
  { key: "spec", name: "spec.md", source: "sdd-spec" },
  { key: "plan", name: "plan.md", source: "sdd-plan" },
  { key: "tasks", name: "tasks.md", source: "sdd-tasks" },
  { key: "analyze", name: "analyze.md", source: "sdd-analyze" },
]

export async function ingestSddDocuments(
  client: GraphitiClient,
  docs: SddDocuments,
): Promise<{ ids: string[]; skipped: string[] }> {
  const ids: string[] = []
  const skipped: string[] = []
  const goal = docs.goal?.trim()
  if (goal) {
    const header = await client.addEpisode({
      name: "sdd-goal",
      body: JSON.stringify({ kind: "project_goal", goal }),
      source: "json",
      sourceDescription: "sdd-goal",
    })
    ids.push(header.id)
  }
  for (const doc of DOCS) {
    const raw = docs[doc.key]
    if (typeof raw !== "string") {
      skipped.push(doc.name)
      continue
    }
    const body = raw.trim()
    if (!body) {
      skipped.push(doc.name)
      continue
    }
    const chunks = splitForEpisode(body)
    for (let i = 0; i < chunks.length; i++) {
      const stored = await client.addEpisode({
        name: chunks.length === 1 ? doc.name : `${doc.name}#${i + 1}`,
        body: chunks[i],
        source: "text",
        sourceDescription: doc.source,
      })
      ids.push(stored.id)
    }
  }
  return { ids, skipped }
}

export function splitForEpisode(text: string, max = 6_000): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  const blocks = text.split(/\n(?=#{1,3}\s)/)
  let buf = ""
  for (const block of blocks) {
    if (buf && buf.length + block.length + 1 > max) {
      parts.push(buf)
      buf = block
    } else {
      buf = buf ? `${buf}\n${block}` : block
    }
  }
  if (buf) parts.push(buf)
  const flattened: string[] = []
  for (const part of parts) {
    if (part.length <= max) flattened.push(part)
    else {
      for (let i = 0; i < part.length; i += max) flattened.push(part.slice(i, i + max))
    }
  }
  return flattened
}
