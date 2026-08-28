import assert from "node:assert/strict"
import { test } from "node:test"
import { createMemoryLayer } from "./layer.js"

test("local layer health is ok and records persist across queries", async () => {
  const layer = createMemoryLayer({ mode: "local" })
  const health = await layer.health()
  assert.deepEqual(health, { automem: "ok", graphiti: "ok" })
  await layer.recordRunComplete({
    runId: "r1",
    asked: "Should we use Postgres?",
    decided: "No. Use SQLite.",
    results: [{ taskId: "decide-db", output: "sqlite", attempt: 1, passed: true }],
  })
  await layer.ingestSddDocuments({
    constitution: "The agent is local-first. Persistence is a single SQLite file.",
    spec: "Memory package talks to AutoMem and Graphiti over HTTP.",
  })
  const later = await layer.getProjectContext("Postgres versus SQLite")
  assert.ok(later.relevantMemories.some((m) => /sqlite/i.test(m)))
  assert.ok(later.relevantKnowledgeGraphFacts.length >= 1)
})

test("ingest skips empty docs and still writes present ones", async () => {
  const layer = createMemoryLayer({ mode: "local" })
  const res = await layer.ingestSddDocuments({ plan: "Ship memory next." })
  assert.ok(res.ids.length >= 1)
  assert.ok(res.skipped.includes("constitution.md"))
})
