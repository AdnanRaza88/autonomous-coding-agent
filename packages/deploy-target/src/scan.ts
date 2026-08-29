import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import type { PackedFile } from "./types.js"

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".cache",
])

const SKIP_FILES = new Set([".ds_store", "thumbs.db"])

const MAX_FILES = 400
const MAX_BYTES = 12 * 1024 * 1024

export function collectProjectFiles(projectDir: string): PackedFile[] {
  const root = resolve(projectDir)
  const out: PackedFile[] = []
  let total = 0
  walk(root, root, out, () => {
    if (out.length >= MAX_FILES) return false
    if (total >= MAX_BYTES) return false
    return true
  })
  for (const file of out) total += file.size
  if (out.length === 0) {
    throw new Error(`no deployable files under ${projectDir}`)
  }
  return out
}

function walk(
  root: string,
  dir: string,
  out: PackedFile[],
  keepGoing: () => boolean,
): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!keepGoing()) return
    const name = entry.name
    if (name.startsWith(".") && name !== ".well-known") {
      if (entry.isDirectory() && SKIP_DIRS.has(name)) continue
      if (!entry.isFile()) continue
    }
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      walk(root, resolve(dir, name), out, keepGoing)
      continue
    }
    if (!entry.isFile()) continue
    if (SKIP_FILES.has(name.toLowerCase())) continue
    const abs = resolve(dir, name)
    let stat
    try {
      stat = statSync(abs)
    } catch {
      continue
    }
    if (stat.size > 4 * 1024 * 1024) continue
    const data = readFileSync(abs)
    const rel = relative(root, abs).split(sep).join("/")
    out.push({
      path: rel,
      data,
      size: data.length,
      sha1: createHash("sha1").update(data).digest("hex"),
    })
  }
}

export function slugFromName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return cleaned || "agent-core-app"
}
