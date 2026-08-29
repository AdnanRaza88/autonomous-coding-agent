import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { healthUrl, probeHttp, waitHealthy } from "./health.js"
import { LOOPBACK } from "./ports.js"

test("probeHttp reads ok from a live listener", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: true }))
  })
  await new Promise<void>((r) => server.listen(0, LOOPBACK, () => r()))
  const addr = server.address()
  const port = typeof addr === "object" && addr ? addr.port : 0
  try {
    assert.equal(await probeHttp(healthUrl(port), 400), true)
    assert.equal(healthUrl(port), `http://${LOOPBACK}:${port}/api/health`)
  } finally {
    await new Promise<void>((r) => server.close(() => r()))
  }
})

test("waitHealthy times out when the target is down", async () => {
  const ok = await waitHealthy("http://127.0.0.1:1/api/health", 60, 20, probeHttp)
  assert.equal(ok, false)
})
