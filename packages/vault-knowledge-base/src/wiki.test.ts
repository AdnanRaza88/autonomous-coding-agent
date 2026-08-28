import assert from "node:assert/strict"
import { test } from "node:test"
import { parseWikiLinks, splitWikiTarget, bodyHasLinkTo } from "./wiki.js"

test("parses wiki links with alias and heading", () => {
  const links = parseWikiLinks("See [[Use SQLite|sqlite]] and [[Home#Layout]].")
  assert.equal(links.length, 2)
  assert.equal(links[0].target, "Use SQLite")
  assert.equal(links[0].alias, "sqlite")
  assert.equal(links[1].heading, "Layout")
})

test("splitWikiTarget drops folder prefix and md suffix", () => {
  const parsed = splitWikiTarget("decisions/Use SQLite.md|pick")
  assert.equal(parsed.target, "Use SQLite")
  assert.equal(parsed.alias, "pick")
})

test("bodyHasLinkTo matches slug, not raw case", () => {
  assert.equal(bodyHasLinkTo("[[Use SQLite]]", "use-sqlite"), true)
  assert.equal(bodyHasLinkTo("no links", "Use SQLite"), false)
})
