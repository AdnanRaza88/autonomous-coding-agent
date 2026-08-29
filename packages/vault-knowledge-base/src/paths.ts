import path from "node:path"
import type { VaultNoteKind } from "./types.js"

const KIND_DIR: Record<VaultNoteKind, string> = {
  index: "",
  entity: "entities",
  module: "modules",
  decision: "decisions",
  constraint: "constraints",
  run: "runs",
}

export function slugify(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const slug = trimmed
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.slice(0, 80) || "note"
}

export function kindFromProperties(properties: Record<string, string>): VaultNoteKind {
  const raw = (properties.kind ?? properties.type ?? "").trim().toLowerCase()
  if (raw === "module" || raw === "decision" || raw === "constraint" || raw === "run" || raw === "index" || raw === "entity") {
    return raw
  }
  return "entity"
}

export function dirForKind(kind: VaultNoteKind): string {
  return KIND_DIR[kind]
}

export function noteFileName(id: string, title: string): string {
  const fromTitle = slugify(title)
  const fromId = slugify(id)
  const base = fromTitle !== "note" ? fromTitle : fromId
  return `${base}.md`
}

export function resolveNotePath(root: string, kind: VaultNoteKind, id: string, title: string): string {
  const dir = dirForKind(kind)
  const name = noteFileName(id, title)
  return dir ? path.join(root, dir, name) : path.join(root, name)
}

export function isMarkdownFile(filePath: string): boolean {
  return filePath.endsWith(".md")
}

export function relativeVaultPath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/")
}

export function isInsideVault(root: string, filePath: string): boolean {
  const resolved = path.resolve(filePath)
  const base = path.resolve(root)
  return resolved === base || resolved.startsWith(base + path.sep)
}
