import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { parseFrontmatter } from "./frontmatter.js"
import { writeVaultNoteAt } from "./write.js"
import { loadVaultNotes } from "./scan.js"

test("writeVaultNoteAt stores yaml plus wiki links on disk", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-write-"))
  await writeVaultNoteAt(root, {
    id: "decision-sqlite",
    title: "Use SQLite",
    body: "Single-file local persistence.",
    links: ["Memory package"],
    properties: { kind: "decision" },
  })
  const notes = await loadVaultNotes(root)
  const note = notes.find((n) => n.id === "decision-sqlite")
  assert.ok(note)
  assert.equal(note?.kind, "decision")
  assert.match(note?.path ?? "", /^decisions\//)
  const raw = await readFile(path.join(root, note!.path), "utf8")
  const parsed = parseFrontmatter(raw)
  assert.equal(parsed.frontmatter.id, "decision-sqlite")
  assert.match(parsed.body, /\[\[Memory package\]\]/)
})

test("rewriting the same id updates the existing file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-upd-"))
  await writeVaultNoteAt(root, {
    id: "mod-memory",
    title: "Memory package",
    body: "First draft.",
    links: [],
    properties: { kind: "module" },
  })
  await writeVaultNoteAt(root, {
    id: "mod-memory",
    title: "Memory package",
    body: "Talks to AutoMem and Graphiti.",
    links: ["Use SQLite"],
    properties: { kind: "module" },
  })
  const notes = await loadVaultNotes(root)
  assert.equal(notes.filter((n) => n.id === "mod-memory").length, 1)
  assert.match(notes[0].body, /Graphiti/)
})
