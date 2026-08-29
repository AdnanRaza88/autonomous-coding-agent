import assert from "node:assert/strict"
import { test } from "node:test"
import {
  decodeInbound,
  nextBackoff,
  parseSseBlock,
  permissionEventsUrl,
  runEventsUrl,
  terminalEvent,
  withAfter,
} from "./stream.ts"

test("parseSseBlock reads named orchestrator frames", () => {
  const raw =
    'id: 0\nevent: orchestrator\ndata: {"channel":"orchestrator","runId":"r1","event":{"type":"planning"}}\n\n'
  const frames = parseSseBlock(raw)
  assert.equal(frames.length, 1)
  assert.equal(frames[0]?.id, "0")
  const inbound = decodeInbound(frames[0]!.event, frames[0]!.data)
  assert.equal(inbound?.channel, "orchestrator")
  if (inbound?.channel === "orchestrator") {
    assert.equal(inbound.runId, "r1")
    assert.equal(inbound.event.type, "planning")
  }
})

test("decodeInbound accepts permission frames", () => {
  const inbound = decodeInbound(
    "permission",
    JSON.stringify({
      channel: "permission",
      prompt: { id: "perm_1", kind: "mcp_tool", action: "write", risk: "high" },
    }),
  )
  assert.equal(inbound?.channel, "permission")
})

test("event urls stay under /api and can carry after", () => {
  assert.equal(runEventsUrl("run/1", "http://localhost:3000"), "http://localhost:3000/api/runs/run%2F1/events")
  assert.equal(
    runEventsUrl("r1", "http://localhost:3000", 4),
    "http://localhost:3000/api/runs/r1/events?after=4",
  )
  assert.equal(permissionEventsUrl("http://localhost:3000"), "http://localhost:3000/api/permissions/events")
  assert.equal(withAfter("/api/runs/r1/events", 2), "/api/runs/r1/events?after=2")
})

test("backoff doubles until the cap", () => {
  assert.equal(nextBackoff(0, 250, 8000), 250)
  assert.equal(nextBackoff(1, 250, 8000), 500)
  assert.equal(nextBackoff(2, 250, 8000), 1000)
  assert.equal(nextBackoff(10, 250, 8000), 8000)
})

test("terminalEvent closes after complete or error", () => {
  assert.equal(terminalEvent({ channel: "orchestrator", runId: "r", event: { type: "planning" } }), false)
  assert.equal(terminalEvent({ channel: "orchestrator", runId: "r", event: { type: "run_complete", results: [] } }), true)
  assert.equal(terminalEvent({ channel: "orchestrator", runId: "r", event: { type: "error", message: "x" } }), true)
})
