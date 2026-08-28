import { promises as fs } from "node:fs"
import path from "node:path"
import { isMarkdownFile, relativeVaultPath } from "./paths.js"
import { noteKind, parseNoteText } from "./render.js"
import type { VaultNote } from "./types.js"

export async function listMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = []
  await walk(root, root, out)
  return out.sort()
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (isMissing(err)) return
    throw err
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(root, full, out)
      continue
    }
    if (entry.isFile() && isMarkdownFile(entry.name)) out.push(full)
  }
}

export async function loadNote(root: string, filePath: string): Promise<VaultNote | null> {
  let raw: string
  let stat
  try {
    stat = await fs.stat(filePath)
    raw = await fs.readFile(filePath, "utf8")
  } catch (err) {
    if (isMissing(err)) return null
    throw err
  }
  const parsed = parseNoteText(raw)
  const rel = relativeVaultPath(root, filePath)
  const title =
    parsed.frontmatter.title ||
    headingTitle(parsed.body) ||
    path.basename(filePath, ".md")
  const id = parsed.frontmatter.id || slugFromPath(rel)
  const aliases = splitList(parsed.frontmatter.aliases)
  return {
    id,
    title,
    body: parsed.body,
    links: parsed.links.map((l) => l.target),
    properties: parsed.frontmatter,
    path: rel,
    kind: noteKind(parsed.frontmatter),
    aliases,
    mtimeMs: stat.mtimeMs,
  }
}

export async function loadVaultNotes(root: string): Promise<VaultNote[]> {
  const files = await listMarkdownFiles(root)
  const notes: VaultNote[] = []
  for (const file of files) {
    const note = await loadNote(root, file)
    if (note) notes.push(note)
  }
  return notes
}

function headingTitle(body: string): string | undefined {
  const m = body.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : undefined
}

function slugFromPath(rel: string): string {
  return path.basename(rel, ".md")
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
}

export function isMissing(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ENOENT")
}
