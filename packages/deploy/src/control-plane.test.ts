import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import type { AgentResult, AgentTask, ChatMessage, ProviderConfig, SharedSpec } from "@agent-core/types"
import { setMcpConnector } from "@agent-core/mcp-hooks-plugins"
import { createApp } from "./server.js"
import { resetControlPlaneState } from "./control-plane.js"

test("control plane serves catalog, saved keys, runs, commands, and mcp", async () => {
  resetControlPlaneState()
  setMcpConnector(async (id, config) => ({
    id,
    config,
    listTools: async () => [{ serverId: id, name: "ping", description: "ping" }],
    callTool: async () => ({ ok: true }),
    close: async () => undefined,
  }))

  const dataDir = mkdtempSync(join(tmpdir(), "ac-cp-"))
  const handle = await createApp({
    dataDir,
    runOptions: {
      chat: async (_config: ProviderConfig, messages: ChatMessage[]) => {
        const last = messages[messages.length - 1]?.content ?? ""
        if (last.includes("SharedSpec") || last.includes("goal")) {
          return JSON.stringify({ goal: "ship a cli", constraints: { tests: "required" } })
        }
        return JSON.stringify({
          tasks: [
            {
              id: "t1",
              title: "Write spec",
              instructions: "draft the spec",
              dependsOn: [],
            },
          ],
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

  const catalog = await app.inject({ method: "GET", url: "/api/providers" })
  assert.equal(catalog.statusCode, 200)
  assert.ok(Array.isArray(catalog.json()))
  assert.ok(catalog.json().some((p: { id: string }) => p.id === "openai" || p.id === "groq" || p.id.length > 0))

  const savedEmpty = await app.inject({ method: "GET", url: "/api/providers/saved" })
  assert.equal(savedEmpty.statusCode, 200)
  assert.deepEqual(savedEmpty.json(), [])

  const put = await app.inject({
    method: "POST",
    url: "/api/providers",
    payload: {
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "gsk-secret",
      model: "llama-3.3-70b-versatile",
      contextWindow: 128000,
    },
  })
  assert.equal(put.statusCode, 200)
  assert.equal(put.json().hasKey, true)
  assert.equal(JSON.stringify(put.json()).includes("gsk-secret"), false)

  const start = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload: { goal: "ship a typescript cli with tests", providerId: "groq", model: "llama-3.3-70b-versatile" },
  })
  assert.equal(start.statusCode, 200)
  const runId = start.json().runId as string
  assert.ok(runId)

  const snap = await waitForRun(app, runId)
  assert.ok(snap.tasks.length >= 1)
  assert.ok(snap.events.some((e: { type: string }) => e.type === "planning"))
  assert.ok(snap.status === "complete" || snap.status === "running" || snap.status === "planning")

  const commands = await app.inject({ method: "GET", url: "/api/commands" })
  assert.equal(commands.statusCode, 200)
  assert.ok(commands.json().some((c: { name: string }) => c.name === "help"))

  const help = await app.inject({
    method: "POST",
    url: "/api/commands/help",
    payload: { args: [] },
  })
  assert.equal(help.statusCode, 200)
  assert.ok(typeof help.json().output === "string")

  const mcp = await app.inject({
    method: "POST",
    url: "/api/mcp/servers",
    payload: { id: "filesystem", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] },
  })
  assert.equal(mcp.statusCode, 200)
  assert.equal(mcp.json().connected, true)

  const listed = await app.inject({ method: "GET", url: "/api/mcp/servers" })
  assert.ok(listed.json().some((s: { id: string }) => s.id === "filesystem"))

  const custom = await app.inject({
    method: "POST",
    url: "/api/subagents",
    payload: {
      id: "reviewer",
      name: "Reviewer",
      systemPromptTemplate: "Review the diff against the spec.",
      defaultModel: "llama-3.3-70b-versatile",
      maxContextTokens: 16000,
      tools: ["read"],
    },
  })
  assert.equal(custom.statusCode, 200)
  const all = await app.inject({ method: "GET", url: "/api/subagents" })
  assert.ok(all.json().some((s: { id: string }) => s.id === "reviewer"))

  await handle.close()
})

async function waitForRun(app: { inject: Function }, runId: string): Promise<any> {
  for (let i = 0; i < 40; i++) {
    const res = await app.inject({ method: "GET", url: `/api/runs/${runId}` })
    if (res.statusCode === 200) {
      const body = res.json()
      if (body.status === "complete" || body.status === "error" || body.tasks.length > 0) return body
    }
    await new Promise((r) => setTimeout(r, 25))
  }
  const last = await app.inject({ method: "GET", url: `/api/runs/${runId}` })
  return last.json()
}
