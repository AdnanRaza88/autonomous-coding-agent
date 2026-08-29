import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { McpError } from "./errors.js"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { filePermissionStore } from "./persist.js"
import {
  addPermissionRule,
  grantAlways,
  grantSession,
  listPermissionRules,
  loadPersistedRules,
  requestPermission,
  revokeGrants,
  setPermissionHandler,
  setPermissionStore,
} from "./permission.js"
import type { PermissionRequest } from "./types.js"

afterEach(() => {
  revokeGrants()
  setPermissionHandler(undefined)
  setPermissionStore(undefined)
})

function req(over: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    kind: "mcp_tool",
    action: "mcp:filesystem:read_file",
    risk: "high",
    serverId: "filesystem",
    toolName: "read_file",
    ...over,
  }
}

test("denies high-risk actions when no handler is set", async () => {
  await assert.rejects(() => requestPermission(req()), (err: unknown) => {
    assert.ok(err instanceof McpError)
    assert.equal(err.code, "permission_denied")
    return true
  })
})

test("allows low-risk actions without a handler", async () => {
  const ok = await requestPermission(req({ risk: "low", action: "mcp:fs:list" }))
  assert.equal(ok, true)
})

test("honors session grants and handler decisions", async () => {
  const first = req({ action: "mcp:git:commit", toolName: "git_commit" })
  grantSession(first)
  assert.equal(await requestPermission(first), true)

  setPermissionHandler(async () => "allow_session")
  const second = req({ action: "mcp:git:push", toolName: "git_push" })
  assert.equal(await requestPermission(second), true)
  setPermissionHandler(async () => false)
  assert.equal(await requestPermission(second), true)
})

test("handler deny throws", async () => {
  setPermissionHandler(async () => "deny")
  await assert.rejects(() => requestPermission(req()))
})

test("allow_server covers other tools on the same server", async () => {
  setPermissionHandler(async () => "allow_server")
  const write = req({ action: "mcp:filesystem:write_file", toolName: "write_file" })
  assert.equal(await requestPermission(write), true)
  setPermissionHandler(async () => "deny")
  const read = req({ action: "mcp:filesystem:read_file", toolName: "read_file" })
  assert.equal(await requestPermission(read), true)
})

test("deny_session blocks later prompts for the same action", async () => {
  setPermissionHandler(async () => "deny_session")
  await assert.rejects(() => requestPermission(req()))
  setPermissionHandler(async () => "allow")
  await assert.rejects(() => requestPermission(req()))
})

test("expired rules are ignored", async () => {
  addPermissionRule({
    effect: "allow",
    scope: "exact",
    persist: "session",
    kind: "mcp_tool",
    action: "mcp:filesystem:read_file",
    serverId: "filesystem",
    toolName: "read_file",
    expiresAt: Date.now() - 10,
  })
  assert.equal(listPermissionRules().length, 0)
  await assert.rejects(() => requestPermission(req()))
})

test("allow_always survives session clear via persist flag", async () => {
  setPermissionHandler(async () => "allow_always")
  assert.equal(await requestPermission(req()), true)
  const listed = listPermissionRules()
  assert.equal(listed.some((r) => r.persist === "always"), true)
})

test("always grants survive a process-local store reload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "perm-store-"))
  const path = join(dir, "permissions.json")
  setPermissionStore(filePermissionStore(path))
  grantAlways(req())
  assert.equal(listPermissionRules().some((r) => r.persist === "always"), true)
  setPermissionStore(undefined)
  revokeGrants()
  setPermissionStore(filePermissionStore(path))
  const restored = loadPersistedRules()
  assert.equal(restored.length, 1)
  assert.equal(restored[0]?.action, "mcp:filesystem:read_file")
  assert.equal(await requestPermission(req()), true)
})
