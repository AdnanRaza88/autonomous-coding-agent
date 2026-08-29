import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
  connectMcpServer,
  disconnectAll,
  invokeMcpTool,
  registerBuiltinCommands,
  registerSlashCommand,
  runSlashCommand,
  setMcpConnector,
  setPermissionHandler,
  revokeGrants,
  clearSlashCommands,
} from "@agent-core/mcp-hooks-plugins"
import type { LiveMcpSession, McpServerConfig, PermissionRequest } from "@agent-core/mcp-hooks-plugins"

afterEach(async () => {
  await disconnectAll()
  setMcpConnector(undefined)
  revokeGrants()
  setPermissionHandler(undefined)
  clearSlashCommands()
})

function fakeSession(id: string, config: McpServerConfig): LiveMcpSession {
  return {
    id,
    config,
    async listTools() {
      return [{ serverId: id, name: "read_file", description: "read" }]
    },
    async callTool(name, args) {
      if (name === "read_file") return `contents:${String(args.path ?? "")}`
      throw new Error(`missing ${name}`)
    },
    async close() {},
  }
}

test("slash command hits the permission gate before the mock MCP tool runs", async () => {
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })

  const gate: PermissionRequest[] = []
  let toolRan = false
  setPermissionHandler(async (req) => {
    gate.push(req)
    return "allow"
  })

  registerSlashCommand({
    name: "read",
    description: "read a file through MCP",
    risk: "medium",
    handler: async (args) => {
      toolRan = true
      await invokeMcpTool("filesystem", "read_file", { path: args[0] })
    },
  })

  await runSlashCommand("read", ["src/index.ts"], { cwd: process.cwd() })

  assert.equal(toolRan, true)
  assert.ok(gate.length >= 1)
  assert.equal(gate[0].kind, "slash_command")
  assert.equal(gate[0].action, "/read")
  const toolGate = gate.find((g) => g.kind === "mcp_tool")
  assert.ok(toolGate)
  assert.equal(toolGate?.toolName, "read_file")
  assert.equal(gate.findIndex((g) => g.kind === "slash_command") < gate.findIndex((g) => g.kind === "mcp_tool"), true)
})

test("denied slash command never reaches the MCP tool", async () => {
  setMcpConnector(async (id, config) => fakeSession(id, config))
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })
  setPermissionHandler(async () => false)

  let invoked = false
  registerSlashCommand({
    name: "read",
    description: "read",
    risk: "high",
    handler: async () => {
      invoked = true
    },
  })

  await assert.rejects(() => runSlashCommand("read", [], { cwd: process.cwd() }))
  assert.equal(invoked, false)
})

test("builtin catalog registers after a clear", () => {
  registerBuiltinCommands()
})
