import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import type { AgentResult, AgentTask, ChatMessage, ProviderConfig, SharedSpec } from "@agent-core/types"
import { createApp } from "./server.js"
import { resetControlPlaneState } from "./control-plane.js"

test("knowledge plane exposes memory, vault, and deploy catalog", async () => {
  process.env.AGENT_CORE_MEMORY_MODE = "local"
  resetControlPlaneState()
  const dataDir = mkdtempSync(join(tmpdir(), "ac-know-"))
  const handle = await createApp({
    dataDir,
    runOptions: {
      chat: async (_config: ProviderConfig, messages: ChatMessage[]) => {
        const last = messages[messages.length - 1]?.content ?? ""
        if (last.includes("SharedSpec") || last.includes("goal")) {
          return JSON.stringify({ goal: "ship a static landing page", constraints: { deploy: "vercel" } })
        }
        return JSON.stringify({
          tasks: [{ id: "t1", title: "Write copy", instructions: "draft", dependsOn: [] }],
        })
      },
      runTask: async (task: AgentTask, _spec: SharedSpec): Promise<AgentResult> => ({
        taskId: task.id,
        output: `${task.title} done`,
        attempt: 1,
        passed: true,
      }),
      verify: async () => ({ pass: true, feedback: "ok" }),
    },
  })
  const app = handle.app

  const health = await app.inject({ method: "GET", url: "/api/memory/health" })
  assert.equal(health.statusCode, 200)
  assert.equal(health.json().automem, "ok")
  assert.equal(health.json().graphiti, "ok")

  const fact = await app.inject({
    method: "POST",
    url: "/api/memory/facts",
    payload: { statement: "Prefer Groq for cheap inference on this workspace." },
  })
  assert.equal(fact.statusCode, 200)
  assert.ok(fact.json().id)

  const listed = await app.inject({ method: "GET", url: "/api/memory/facts?q=Groq" })
  assert.equal(listed.statusCode, 200)
  assert.ok(listed.json().facts.length >= 1)

  const ctx = await app.inject({ method: "GET", url: "/api/memory/context?q=Groq" })
  assert.equal(ctx.statusCode, 200)
  assert.ok(Array.isArray(ctx.json().relevantMemories) || Array.isArray(ctx.json().relevantKnowledgeGraphFacts))

  const notes = await app.inject({ method: "GET", url: "/api/vault/notes" })
  assert.equal(notes.statusCode, 200)
  assert.ok(notes.json().notes.some((n: { id: string }) => n.id === "home"))

  const written = await app.inject({
    method: "POST",
    url: "/api/vault/notes",
    payload: {
      id: "stack",
      title: "Stack",
      body: "Local-first TypeScript monorepo. See [[Home]].",
      links: ["Home"],
      properties: { kind: "module" },
    },
  })
  assert.equal(written.statusCode, 200)
  assert.equal(written.json().title, "Stack")

  const graph = await app.inject({ method: "GET", url: "/api/vault/graph" })
  assert.equal(graph.statusCode, 200)
  assert.ok(graph.json().nodes.some((n: { id: string }) => n.id === "stack" || n.title === "Stack"))

  const targets = await app.inject({ method: "GET", url: "/api/deploy/targets" })
  assert.equal(targets.statusCode, 200)
  assert.ok(targets.json().some((t: { id: string }) => t.id === "vercel" || t.id === "fly"))

  const creds = await app.inject({
    method: "POST",
    url: "/api/deploy/credentials",
    payload: { targetId: "vercel", token: "tok_secret" },
  })
  assert.equal(creds.statusCode, 200)
  assert.equal(creds.json().hasToken, true)
  assert.equal(JSON.stringify(creds.json()).includes("tok_secret"), false)

  await app.inject({
    method: "POST",
    url: "/api/providers",
    payload: {
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "k",
      model: "llama-3.3-70b-versatile",
      contextWindow: 128000,
    },
  })
  const start = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload: { goal: "ship a static landing page", providerId: "groq" },
  })
  assert.equal(start.statusCode, 200)
  const runId = start.json().runId as string

  for (let i = 0; i < 30; i++) {
    const snap = await app.inject({ method: "GET", url: `/api/runs/${runId}` })
    if (snap.statusCode === 200 && snap.json().status !== "planning") break
    await new Promise((r) => setTimeout(r, 20))
  }

  const detect = await app.inject({ method: "GET", url: `/api/deploy/detect?runId=${runId}` })
  assert.equal(detect.statusCode, 200)
  assert.ok(detect.json().kind === "static" || detect.json().kind === "container")

  const missing = await app.inject({
    method: "POST",
    url: "/api/deploy",
    payload: { runId: "does-not-exist", targetId: "vercel" },
  })
  assert.equal(missing.statusCode, 400)

  await handle.close()
})
