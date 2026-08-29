import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeInbound, parseSseBlock, permissionEventsUrl, runEventsUrl } from "./stream.ts"

test("parseSseBlock reads named orchestrator frames", () => {
  const raw =
    'event: orchestrator\ndata: {"channel":"orchestrator","runId":"r1","event":{"type":"planning"}}\n\n'
  const frames = parseSseBlock(raw)
  assert.equal(frames.length, 1)
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

test("event urls stay under /api", () => {
  assert.equal(runEventsUrl("run/1", "http://localhost:3000"), "http://localhost:3000/api/runs/run%2F1/events")
  assert.equal(permissionEventsUrl("http://localhost:3000"), "http://localhost:3000/api/permissions/events")
})
