import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
  connectMcpServer,
  disconnectAll,
  invokeMcpTool,
  listMcpTools,
  setMcpConnector,
} from "./client.js"
import { McpError } from "./errors.js"
import { clearHooks, registerHook } from "./hooks.js"
import { revokeGrants, setPermissionHandler } from "./permission.js"
import type { LiveMcpSession, McpServerConfig } from "./types.js"

afterEach(async () => {
  await disconnectAll()
  setMcpConnector(undefined)
  revokeGrants()
  setPermissionHandler(undefined)
  clearHooks()
})

function fakeSession(id: string, config: McpServerConfig): LiveMcpSession {
  const tools = [
    { serverId: id, name: "read_file", description: "read" },
    { serverId: id, name: "write_file", description: "write" },
  ]
  return {
    id,
    config,
    async listTools() {
      return tools
    },
    async callTool(name, args) {
      if (name === "write_file") return { wrote: args.path }
      if (name === "read_file") return `contents:${args.path}`
      throw new Error(`missing ${name}`)
    },
    async close() {},
  }
}

test("connects through config and lists tools", async () => {
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx", args: ["fs"] })
  const tools = await listMcpTools("filesystem")
  assert.equal(tools.length, 2)
  assert.equal(tools[0].name, "read_file")
})

test("rejects unknown servers and tools", async () => {
  await assert.rejects(() => listMcpTools("nope"), (err: unknown) => {
    assert.ok(err instanceof McpError)
    assert.equal(err.code, "unknown_server")
    return true
  })
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })
  await assert.rejects(() => invokeMcpTool("filesystem", "explode", {}), (err: unknown) => {
    assert.ok(err instanceof McpError)
    assert.equal(err.code, "unknown_tool")
    return true
  })
})

test("permission gate blocks tool calls", async () => {
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })
  setPermissionHandler(async () => false)
  await assert.rejects(() => invokeMcpTool("filesystem", "write_file", { path: "a.ts" }))
})

test("allowed tool calls run before and after hooks", async () => {
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })
  setPermissionHandler(async () => true)
  const points: string[] = []
  registerHook("before-tool-call", "pre", async (ctx) => {
    points.push(`pre:${ctx.toolName}`)
  })
  registerHook("after-tool-call", "post", async (ctx) => {
    points.push(`post:${String(ctx.result)}`)
  })
  const result = await invokeMcpTool("filesystem", "read_file", { path: "x.ts" })
  assert.equal(result, "contents:x.ts")
  assert.deepEqual(points, ["pre:read_file", "post:contents:x.ts"])
})

test("rejects incomplete config", async () => {
  await assert.rejects(
    () => connectMcpServer("bad", { transport: "stdio" }),
    (err: unknown) => {
      assert.ok(err instanceof McpError)
      assert.equal(err.code, "bad_config")
      return true
    }
  )
})
