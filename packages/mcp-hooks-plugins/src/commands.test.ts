import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { connectMcpServer, disconnectAll, setMcpConnector } from "./client.js"
import {
  clearSlashCommands,
  listSlashCommands,
  registerBuiltinCommands,
  runSlashCommand,
} from "./commands.js"
import { McpError } from "./errors.js"
import { revokeGrants, setPermissionHandler } from "./permission.js"
import type { LiveMcpSession, RunContext } from "./types.js"

afterEach(async () => {
  await disconnectAll()
  setMcpConnector(undefined)
  revokeGrants()
  setPermissionHandler(undefined)
  clearSlashCommands()
  registerBuiltinCommands()
})

function ctx(): RunContext {
  return { cwd: "/tmp/proj", extras: {}, emit() {} }
}

test("registers at least fifty builtin commands", () => {
  const names = listSlashCommands().map((cmd) => cmd.name)
  assert.ok(names.length >= 50, `only ${names.length}`)
  assert.ok(names.includes("plan"))
  assert.ok(names.includes("remember"))
  assert.ok(names.includes("mcp-call"))
})

test("unknown command fails closed", async () => {
  setPermissionHandler(async () => true)
  await assert.rejects(() => runSlashCommand("nope", [], ctx()), (err: unknown) => {
    assert.ok(err instanceof McpError)
    assert.equal(err.code, "unknown_command")
    return true
  })
})

test("slash commands require permission", async () => {
  setPermissionHandler(async () => false)
  await assert.rejects(() => runSlashCommand("commit", ["wip"], ctx()))
})

test("file commands queue when the server is offline", async () => {
  setPermissionHandler(async () => true)
  const run = ctx()
  await runSlashCommand("read", ["src/index.ts"], run)
  const results = run.extras?.results as Array<{ queued?: boolean; toolName?: string }>
  assert.equal(results[0].queued, true)
  assert.equal(results[0].toolName, "read_file")
})

test("connected server is invoked by slash commands", async () => {
  setMcpConnector(async (id, config) => {
    const session: LiveMcpSession = {
      id,
      config,
      async listTools() {
        return [{ serverId: id, name: "read_file", description: "read" }]
      },
      async callTool(_name, args) {
        return `ok:${args.path}`
      },
      async close() {},
    }
    return session
  })
  await connectMcpServer("filesystem", { transport: "stdio", command: "npx" })
  setPermissionHandler(async () => true)
  const run = ctx()
  await runSlashCommand("cat", ["README.md"], run)
  const results = run.extras?.results as Array<{ result?: unknown }>
  assert.equal(results[0].result, "ok:README.md")
})
