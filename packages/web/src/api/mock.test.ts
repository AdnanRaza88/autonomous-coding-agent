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

test("listRuns keeps started goals and cancel marks cancelled", async () => {
  const api = createMockApi(createMockBus())
  const started = await api.startRun({ goal: "abort me", providerId: "groq", model: "llama-3.3-70b-versatile" })
  const listed = await api.listRuns()
  assert.ok(listed.some((r) => r.id === started.runId && r.goal === "abort me"))
  const cancelled = await api.cancelRun(started.runId)
  assert.equal(cancelled.cancelled, true)
  const snap = await api.getRun(started.runId)
  assert.equal(snap.status, "cancelled")
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

test("session grants clear while always grants stay until revoke", async () => {
  const api = createMockApi(createMockBus())
  await api.decidePermission("perm_session", "allow_session")
  await api.decidePermission("perm_always", "allow_always")
  const both = await api.listPermissionRules()
  assert.equal(both.length, 2)
  await api.clearPermissionSession()
  const leftover = await api.listPermissionRules()
  assert.equal(leftover.length, 1)
  assert.equal(leftover[0]?.persist, "always")
  await api.removePermissionRule(leftover[0]!.id)
  assert.equal((await api.listPermissionRules()).length, 0)
})

test("memory facts recall and vault notes form a graph", async () => {
  const api = createMockApi(createMockBus())
  const health = await api.memoryHealth()
  assert.equal(health.automem, "ok")
  const saved = await api.addFact({ statement: "Prefer Groq for cheap inference." })
  assert.ok(saved.id)
  const listed = await api.listFacts("Groq")
  assert.equal(listed.length, 1)
  const ctx = await api.memoryContext("Groq")
  assert.ok(ctx.relevantMemories.some((m) => m.includes("Groq")))
  const home = await api.readVaultNote("home")
  assert.equal(home.title, "Home")
  await api.writeVaultNote({
    id: "stack",
    title: "Stack",
    body: "See [[Home]].",
    links: ["Home"],
  })
  const graph = await api.vaultGraph()
  assert.ok(graph.nodes.some((n) => n.id === "stack"))
  assert.ok(graph.edges.some((e) => e.from === "stack"))
})

test("deploy detect and ship hide the token", async () => {
  const api = createMockApi(createMockBus())
  const started = await api.startRun({
    goal: "ship a static landing page",
    providerId: "groq",
    model: "llama-3.3-70b-versatile",
  })
  const detected = await api.detectDeploy(started.runId)
  assert.equal(detected.kind, "static")
  const creds = await api.saveDeployCredentials({ targetId: "vercel", token: "tok_secret" })
  assert.equal(creds.hasToken, true)
  assert.equal(JSON.stringify(creds).includes("tok_secret"), false)
  const live = await api.deployRun({ runId: started.runId, targetId: "vercel" })
  assert.equal(live.status, "live")
  assert.ok(live.url.includes("vercel.app"))
})
