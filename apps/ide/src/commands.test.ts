import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BUILTIN_SLASH,
  commandIdForSlash,
  paletteCommands,
  parseSlashInvocation,
  vscodeCommandContributions,
} from "./commands.js"

test("exposes more than fifty slash commands for the palette", () => {
  assert.ok(BUILTIN_SLASH.length >= 50)
  const ids = new Set(paletteCommands().map((c) => c.id))
  assert.equal(ids.size, BUILTIN_SLASH.length)
  assert.equal(commandIdForSlash("plan"), "agent-core.slash.plan")
})

test("command contributions include host actions and slashes", () => {
  const contrib = vscodeCommandContributions()
  assert.ok(contrib.some((c) => c.command === "agent-core.acceptDiff"))
  assert.ok(contrib.some((c) => c.command === "agent-core.slash.commit"))
  assert.ok(contrib.every((c) => c.category === "Agent Core"))
})

test("parses slash invocations", () => {
  assert.deepEqual(parseSlashInvocation("/commit ship it"), { name: "commit", args: ["ship", "it"] })
  assert.equal(parseSlashInvocation("commit"), null)
  assert.equal(parseSlashInvocation("/"), null)
})
