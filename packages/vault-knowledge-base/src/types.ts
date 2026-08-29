export type VaultNoteKind =
  | "entity"
  | "module"
  | "decision"
  | "constraint"
  | "run"
  | "index"

export interface VaultEntity {
  id: string
  title: string
  body: string
  links: string[]
  properties: Record<string, string>
}

export interface VaultNote extends VaultEntity {
  path: string
  kind: VaultNoteKind
  aliases: string[]
  mtimeMs: number
}

export interface VaultNode {
  id: string
  title: string
  kind: VaultNoteKind
  path: string
  properties: Record<string, string>
}

export interface VaultEdge {
  from: string
  to: string
  label?: string
}

export interface VaultGraph {
  nodes: VaultNode[]
  edges: VaultEdge[]
}

export interface ParsedNote {
  frontmatter: Record<string, string>
  body: string
  links: WikiLink[]
}

export interface WikiLink {
  raw: string
  target: string
  alias?: string
  heading?: string
}

export interface VaultChange {
  path: string
  noteId?: string
  kind: "add" | "change" | "unlink"
  note?: VaultNote
}

export interface VaultSyncSink {
  applyEdit(edit: {
    statement: string
    replaces?: string
    note?: string
    noteId: string
    path: string
  }): Promise<void>
}

export interface VaultOptions {
  root: string
  sync?: VaultSyncSink
  watchDebounceMs?: number
}
