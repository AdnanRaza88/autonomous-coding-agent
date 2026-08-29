import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { grantAlways } from "@agent-core/mcp-hooks-plugins"
import { createApp } from "./server.js"
import { resetControlPlaneState } from "./control-plane.js"

test("always grants written during a boot reload on the next boot", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ac-perm-"))
  resetControlPlaneState()
  const first = await createApp({ dataDir })
  grantAlways({
    kind: "mcp_tool",
    action: "mcp:filesystem:write_file",
    risk: "high",
    serverId: "filesystem",
    toolName: "write_file",
  })
  const listed = await first.app.inject({ method: "GET", url: "/api/permissions/rules" })
  assert.equal(listed.statusCode, 200)
  assert.equal(listed.json().rules.some((r: { persist: string }) => r.persist === "always"), true)
  await first.close()

  resetControlPlaneState()
  const second = await createApp({ dataDir })
  const restored = await second.app.inject({ method: "GET", url: "/api/permissions/rules" })
  assert.equal(restored.statusCode, 200)
  assert.equal(
    restored.json().rules.some((r: { action?: string }) => r.action === "mcp:filesystem:write_file"),
    true,
  )
  const id = restored.json().rules[0].id as string
  const gone = await second.app.inject({ method: "DELETE", url: `/api/permissions/rules/${id}` })
  assert.equal(gone.statusCode, 204)
  const empty = await second.app.inject({ method: "GET", url: "/api/permissions/rules" })
  assert.equal(empty.json().rules.length, 0)
  await second.close()
})
