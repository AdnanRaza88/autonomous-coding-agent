import assert from "node:assert/strict"
import { test } from "node:test"
import { formatSse, parseSseBlock } from "./sse.ts"

test("formatSse writes event and json data", () => {
  const raw = formatSse("orchestrator", { channel: "orchestrator", runId: "r1" })
  assert.equal(raw, 'event: orchestrator\ndata: {"channel":"orchestrator","runId":"r1"}\n\n')
  const frames = parseSseBlock(raw)
  assert.equal(frames.length, 1)
  assert.equal(frames[0]?.event, "orchestrator")
  assert.equal(JSON.parse(frames[0]!.data).runId, "r1")
})
