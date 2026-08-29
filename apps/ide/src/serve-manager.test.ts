import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { AgentServeManager } from "./serve-manager.js"
import { LOOPBACK } from "./ports.js"
import type { SpawnRequest } from "./types.js"

test("starts with injected spawn and probe", async () => {
  const spawned: SpawnRequest[] = []
  const mgr = new AgentServeManager({
    preferredPort: 39111,
    readyTimeoutMs: 500,
    probeIntervalMs: 20,
    spawn: (req) => {
      spawned.push(req)
      return { pid: 4242, kill: () => true }
    },
    probe: async () => true,
  })
  const handle = await mgr.start()
  assert.equal(handle.state, "healthy")
  assert.equal(handle.pid, 4242)
  assert.equal(handle.endpoints.port, 39111)
  assert.equal(handle.endpoints.origin, `http://${LOOPBACK}:39111`)
  assert.match(handle.endpoints.health, /\/api\/health$/)
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].env.HOST, LOOPBACK)
  assert.match(spawned[0].env.NO_PROXY ?? "", /127\.0\.0\.1/)
  await handle.stop()
  assert.equal(mgr.currentState(), "stopped")
})

test("recovers to a later port when preferred is busy", async () => {
  const { createServer } = await import("node:net")
  const blocker = createServer()
  const hold = 39200
  await new Promise<void>((resolve) => blocker.listen(hold, LOOPBACK, () => resolve()))
  try {
    const mgr = new AgentServeManager({
      preferredPort: hold,
      readyTimeoutMs: 400,
      probeIntervalMs: 20,
      spawn: (req) => ({ pid: 7, kill: () => true }),
      probe: async () => true,
    })
    const handle = await mgr.start()
    assert.ok(handle.endpoints.port > hold)
    await handle.stop()
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()))
  }
})

test("throws when probe never succeeds", async () => {
  const mgr = new AgentServeManager({
    preferredPort: 39300,
    readyTimeoutMs: 80,
    probeIntervalMs: 20,
    probeTimeoutMs: 20,
    maxPortAttempts: 2,
    spawn: () => ({ pid: 1, kill: () => true }),
    probe: async () => false,
  })
  await assert.rejects(() => mgr.start(), /health probe failed/)
})

test("cwd is honored", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ide-serve-"))
  let seen = ""
  const mgr = new AgentServeManager({
    cwd: dir,
    preferredPort: 39400,
    readyTimeoutMs: 200,
    spawn: (req) => {
      seen = req.cwd
      return { pid: 3, kill: () => true }
    },
    probe: async () => true,
  })
  const handle = await mgr.start()
  assert.equal(seen, dir)
  await handle.stop()
})
