import assert from "node:assert/strict"
import { test } from "node:test"
import { createMockApi, createMockBus } from "./mock.ts"
import { redactProvider } from "./contract.ts"

test("saved provider never returns the raw key", async () => {
  const api = createMockApi(createMockBus())
  const saved = await api.saveProvider({
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "sk-never-echo",
    model: "llama-3.3-70b-versatile",
    contextWindow: 128000,
  })
  assert.equal(saved.hasKey, true)
  assert.equal("apiKey" in saved, false)
  const listed = await api.listSavedProviders()
  assert.equal(listed[0]?.hasKey, true)
})

test("redactProvider drops apiKey", () => {
  const saved = redactProvider({
    id: "x",
    baseUrl: "http://localhost",
    apiKey: "secret",
    model: "m",
    contextWindow: 8,
  })
  assert.deepEqual(saved, {
    id: "x",
    baseUrl: "http://localhost",
    model: "m",
    contextWindow: 8,
    hasKey: true,
  })
})

test("startRun emits plan then completion on the bus", async () => {
  const bus = createMockBus()
  const api = createMockApi(bus)
  const seen: string[] = []
  const stop = bus.subscribe((msg) => {
    if (msg.channel === "orchestrator") seen.push(msg.event.type)
  })
  const { runId } = await api.startRun({ goal: "ship a cli", providerId: "groq", model: "llama-3.3-70b-versatile" })
  await new Promise((r) => setTimeout(r, 400))
  stop()
  const snap = await api.getRun(runId)
  assert.equal(snap.status, "complete")
  assert.ok(seen.includes("plan_ready"))
  assert.ok(seen.includes("run_complete"))
  assert.ok(snap.tasks.some((t) => t.status === "passed"))
})

test("upserted subagent is listed immediately", async () => {
  const api = createMockApi(createMockBus())
  await api.upsertSubagent({
    id: "reviewer",
    name: "Reviewer",
    systemPromptTemplate: "Review diffs.",
    defaultModel: "gpt-4.1",
    maxContextTokens: 20000,
    tools: ["read"],
  })
  const ids = (await api.listSubagents()).map((s) => s.id)
  assert.ok(ids.includes("reviewer"))
})
