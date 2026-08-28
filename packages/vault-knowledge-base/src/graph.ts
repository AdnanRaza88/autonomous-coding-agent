import { linkTargetKey, parseWikiLinks } from "./wiki.js"
import type { VaultEdge, VaultGraph, VaultNode, VaultNote } from "./types.js"

export function buildVaultGraph(notes: VaultNote[]): VaultGraph {
  const byKey = indexNotes(notes)
  const nodes: VaultNode[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    kind: n.kind,
    path: n.path,
    properties: n.properties,
  }))
  const edges: VaultEdge[] = []
  const seen = new Set<string>()
  for (const note of notes) {
    const parsed = parseWikiLinks(note.body)
    for (const link of parsed) {
      const target = resolveLink(link.target, byKey)
      if (!target || target.id === note.id) continue
      const key = `${note.id}->${target.id}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        from: note.id,
        to: target.id,
        label: link.alias,
      })
    }
  }
  return { nodes, edges }
}

export function backlinksFor(notes: VaultNote[], noteId: string): string[] {
  const byKey = indexNotes(notes)
  const target = byKey.get(linkTargetKey(noteId))
  if (!target) return []
  const keys = new Set(keysFor(target))
  const hits: string[] = []
  for (const note of notes) {
    if (note.id === target.id) continue
    const linked = parseWikiLinks(note.body).some((l) => {
      const resolved = resolveLink(l.target, byKey)
      if (resolved) return resolved.id === target.id
      return keys.has(linkTargetKey(l.target))
    })
    if (linked) hits.push(note.id)
  }
  return hits.sort()
}

export function indexNotes(notes: VaultNote[]): Map<string, VaultNote> {
  const map = new Map<string, VaultNote>()
  for (const note of notes) {
    for (const key of keysFor(note)) {
      if (!map.has(key)) map.set(key, note)
    }
  }
  return map
}

export function keysFor(note: VaultNote): string[] {
  const keys = [linkTargetKey(note.id), linkTargetKey(note.title), linkTargetKey(fileStem(note.path))]
  for (const alias of note.aliases) keys.push(linkTargetKey(alias))
  return [...new Set(keys.filter(Boolean))]
}

export function resolveLink(target: string, byKey: Map<string, VaultNote>): VaultNote | undefined {
  return byKey.get(linkTargetKey(target))
}

function fileStem(rel: string): string {
  const base = rel.split("/").pop() ?? rel
  return base.replace(/\.md$/i, "")
}
