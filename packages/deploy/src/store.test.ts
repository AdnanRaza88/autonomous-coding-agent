import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { generateMasterKey } from "./crypto.js"
import { openStore } from "./store.js"

test("persists encrypted secrets and never writes plaintext", () => {
  const dir = mkdtempSync(join(tmpdir(), "ac-store-"))
  const path = join(dir, "agent-core.db")
  const key = generateMasterKey()
  const store = openStore(path, key)
  store.putSecret("groq", "provider", "gsk_super_secret")
  store.upsertProvider({
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    contextWindow: 128000,
    secretId: "groq",
  })
  const raw = readFileSync(path, "utf8")
  assert.equal(raw.includes("gsk_super_secret"), false)
  assert.equal(store.getSecretPlain("groq"), "gsk_super_secret")
  const again = openStore(path, key)
  assert.equal(again.getSecretPlain("groq"), "gsk_super_secret")
  assert.equal(again.listProviders()[0]?.model, "llama-3.3-70b-versatile")
  assert.deepEqual(again.listSecretIds("provider").map((s) => s.id), ["groq"])
})

test("survives restart of runs and subagent rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "ac-store-"))
  const path = join(dir, "agent-core.db")
  const key = generateMasterKey()
  const store = openStore(path, key)
  store.upsertRun({ id: "run-1", goal: "ship", status: "passed", createdAt: "2026-08-29T00:00:00.000Z" })
  store.upsertSubagent({ id: "reviewer", name: "reviewer", definition: { tools: ["git"] }, updatedAt: "2026-08-29T00:00:00.000Z" })
  const again = openStore(path, key)
  assert.equal(again.listRuns()[0]?.goal, "ship")
  assert.equal(again.listSubagents()[0]?.name, "reviewer")
})
