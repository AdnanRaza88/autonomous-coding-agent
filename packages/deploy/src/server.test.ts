import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createApp } from "./server.js"

test("health, secret encryption, and sandbox gate over HTTP", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ac-http-"))
  const handle = await createApp({ dataDir })
  const app = handle.app

  const health = await app.inject({ method: "GET", url: "/health" })
  assert.equal(health.statusCode, 200)
  assert.equal(health.json().ok, true)

  const put = await app.inject({
    method: "POST",
    url: "/api/secrets",
    payload: { id: "openai", kind: "provider", value: "sk-test-plain" },
  })
  assert.equal(put.statusCode, 200)
  const listed = await app.inject({ method: "GET", url: "/api/secrets" })
  assert.equal(listed.json().secrets[0].id, "openai")
  assert.equal(JSON.stringify(listed.json()).includes("sk-test-plain"), false)

  const blocked = await app.inject({
    method: "POST",
    url: "/api/sandbox/write-check",
    payload: { path: "../outside.txt" },
  })
  assert.equal(blocked.statusCode, 403)
  assert.equal(blocked.json().allowed, false)

  const okCmd = await app.inject({
    method: "POST",
    url: "/api/sandbox/command",
    payload: { command: "npm test" },
  })
  assert.equal(okCmd.statusCode, 200)
  assert.equal(okCmd.json().bin, "npm")

  await handle.close()
})
