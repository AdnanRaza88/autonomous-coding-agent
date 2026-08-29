import { promises as fs } from "node:fs"
import path from "node:path"
import { kindFromProperties, resolveNotePath } from "./paths.js"
import { renderNote } from "./render.js"
import { isMissing, loadVaultNotes } from "./scan.js"
import type { VaultEntity, VaultNote } from "./types.js"

export async function writeVaultNoteAt(root: string, entity: VaultEntity): Promise<VaultNote> {
  const id = entity.id.trim()
  const title = entity.title.trim()
  if (!id) throw new Error("vault note id is empty")
  if (!title) throw new Error("vault note title is empty")

  const kind = kindFromProperties(entity.properties)
  const existing = (await loadVaultNotes(root)).find((n) => n.id === id)
  const dest = existing
    ? path.join(root, existing.path)
    : resolveNotePath(root, kind, id, title)

  await fs.mkdir(path.dirname(dest), { recursive: true })
  const merged: VaultEntity = {
    ...entity,
    id,
    title,
    properties: {
      ...existing?.properties,
      ...entity.properties,
      id,
      title,
      kind,
      updated: new Date().toISOString(),
    },
    links: entity.links,
    body: entity.body,
  }
  const text = renderNote(merged)
  const tmp = `${dest}.${process.pid}.tmp`
  await fs.writeFile(tmp, text, "utf8")
  await fs.rename(tmp, dest)

  if (existing && path.join(root, existing.path) !== dest) {
    try {
      await fs.unlink(path.join(root, existing.path))
    } catch (err) {
      if (!isMissing(err)) throw err
    }
  }

  const rel = dest.slice(path.resolve(root).length).replace(/^[\\/]/, "").split(path.sep).join("/")
  return {
    id,
    title,
    body: merged.body,
    links: merged.links,
    properties: merged.properties,
    path: rel || path.basename(dest),
    kind,
    aliases: splitList(merged.properties.aliases),
    mtimeMs: Date.now(),
  }
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
}

export async function ensureHomeNote(root: string): Promise<void> {
  const home = path.join(root, "Home.md")
  try {
    await fs.access(home)
    return
  } catch {
    await fs.mkdir(root, { recursive: true })
    await writeVaultNoteAt(root, {
      id: "home",
      title: "Home",
      body: "Project wiki. Notes are grouped by kind and linked with Obsidian wiki syntax.",
      links: [],
      properties: { kind: "index" },
    })
  }
}

export async function seedKindFolders(root: string): Promise<void> {
  const dirs = ["entities", "modules", "decisions", "constraints", "runs", "attachments"]
  for (const dir of dirs) {
    await fs.mkdir(path.join(root, dir), { recursive: true })
    const keep = path.join(root, dir, ".gitkeep")
    try {
      await fs.access(keep)
    } catch {
      await fs.writeFile(keep, "", "utf8")
    }
  }
  const obsidian = path.join(root, ".obsidian")
  await fs.mkdir(obsidian, { recursive: true })
  const app = path.join(obsidian, "app.json")
  try {
    await fs.access(app)
  } catch {
    await fs.writeFile(
      app,
      `${JSON.stringify({ legacyEditor: false, livePreview: true, attachmentFolderPath: "attachments" }, null, 2)}\n`,
      "utf8",
    )
  }
}
