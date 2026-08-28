import assert from "node:assert/strict"
import { test } from "node:test"
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js"

test("round-trips yaml frontmatter and body", () => {
  const raw = stringifyFrontmatter(
    { id: "dec-1", title: "Use SQLite", kind: "decision", note: "has: colon" },
    "# Use SQLite\n\nLocal-first.\n",
  )
  assert.match(raw, /^---\n/)
  const parsed = parseFrontmatter(raw)
  assert.equal(parsed.frontmatter.id, "dec-1")
  assert.equal(parsed.frontmatter.title, "Use SQLite")
  assert.equal(parsed.frontmatter.note, "has: colon")
  assert.match(parsed.body, /Local-first/)
})

test("notes without a fence stay body-only", () => {
  const parsed = parseFrontmatter("# Loose note\n\nEdited in Obsidian.\n")
  assert.deepEqual(parsed.frontmatter, {})
  assert.match(parsed.body, /Loose note/)
})
