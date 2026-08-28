import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { McpError } from "./errors.js"
import {
  grantSession,
  requestPermission,
  revokeGrants,
  setPermissionHandler,
} from "./permission.js"
import type { PermissionRequest } from "./types.js"

afterEach(() => {
  revokeGrants()
  setPermissionHandler(undefined)
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
