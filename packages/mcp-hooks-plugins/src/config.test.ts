import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { listConfiguredServers } from "./client.js"
import { loadMcpConfigFile, loadMcpServersFromConfig, parseMcpConfig } from "./config.js"
import { defaultMcpServers } from "./defaults.js"

test("parses mixed stdio and url servers", () => {
  const parsed = parseMcpConfig({
    mcpServers: {
      filesystem: { command: "npx", args: ["-y", "fs", "."] },
      automem: { url: "http://127.0.0.1:8000/mcp", headers: { Authorization: "Bearer x" } },
    },
  })
  assert.equal(parsed.mcpServers.filesystem.transport, "stdio")
  assert.equal(parsed.mcpServers.automem.transport, "url")
})

test("loads a config file and remembers servers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-cfg-"))
  const path = join(dir, "mcp.json")
  await writeFile(
    path,
    JSON.stringify({
      mcpServers: {
        git: { command: "npx", args: ["-y", "git", "."] },
      },
    })
  )
  const file = await loadMcpConfigFile(path)
  assert.equal(file.mcpServers.git.command, "npx")
  await loadMcpServersFromConfig(path)
  assert.ok(listConfiguredServers().includes("git"))
})

test("default catalog includes filesystem git automem graphiti", () => {
  const defaults = defaultMcpServers("/repo")
  assert.deepEqual(Object.keys(defaults).sort(), ["automem", "filesystem", "git", "graphiti"])
  assert.equal(defaults.filesystem.transport, "stdio")
  assert.equal(defaults.automem.transport, "url")
})
