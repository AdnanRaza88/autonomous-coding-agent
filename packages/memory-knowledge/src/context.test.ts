import assert from "node:assert/strict"
import { test } from "node:test"
import { createLocalAutoMem, createLocalGraphiti } from "./local.js"
import { defaultMemoryConfig } from "./config.js"
import { getProjectContextFor } from "./context.js"
import { createMemoryLayer, getProjectContext, resetMemoryLayer, setMemoryLayer } from "./layer.js"

test("getProjectContext returns memories and graph facts for a later query", async () => {
  const automem = createLocalAutoMem()
  const graphiti = createLocalGraphiti()
  await automem.store({
    content: "This project uses SQLite, not Postgres",
    type: "Decision",
    tags: ["database"],
    importance: 0.9,
  })
  await graphiti.addEpisode({
    name: "constitution.md",
    body: "Persistence is SQLite via better-sqlite3. Do not introduce Postgres.",
    sourceDescription: "sdd-constitution",
  })
  const ctx = await getProjectContextFor("what database does this project use", { automem, graphiti }, defaultMemoryConfig())
  assert.ok(ctx.relevantMemories.some((m) => /sqlite/i.test(m)))
  assert.ok(ctx.relevantKnowledgeGraphFacts.some((f) => /sqlite/i.test(f)))
})

test("empty query returns empty context", async () => {
  const layer = createMemoryLayer({ mode: "local" })
  const ctx = await layer.getProjectContext("   ")
  assert.deepEqual(ctx, { relevantMemories: [], relevantKnowledgeGraphFacts: [] })
})

test("module getProjectContext uses the active layer", async () => {
  resetMemoryLayer()
  const layer = createMemoryLayer({ mode: "local" })
  setMemoryLayer(layer)
  await layer.recordRunComplete({
    goal: "ship memory package",
    results: [{ taskId: "t1", output: "done", attempt: 1, passed: true }],
    decided: "AutoMem for sessions, Graphiti for project graph",
  })
  const ctx = await getProjectContext("memory package AutoMem")
  assert.ok(ctx.relevantMemories.length >= 1)
  resetMemoryLayer()
})

test("downed clients do not throw from getProjectContext", async () => {
  const automem = {
    store: async () => ({ id: "x" }),
    recall: async () => {
      throw new Error("down")
    },
    health: async () => false,
  }
  const graphiti = {
    addEpisode: async () => ({ id: "x" }),
    searchFacts: async () => {
      throw new Error("down")
    },
    searchNodes: async () => {
      throw new Error("down")
    },
    listRecent: async () => [],
    health: async () => false,
  }
  const ctx = await getProjectContextFor("anything", { automem, graphiti }, defaultMemoryConfig())
  assert.deepEqual(ctx.relevantMemories, [])
  assert.deepEqual(ctx.relevantKnowledgeGraphFacts, [])
})
