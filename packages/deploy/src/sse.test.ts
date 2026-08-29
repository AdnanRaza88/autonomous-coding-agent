import assert from "node:assert/strict"
import { test } from "node:test"
import { formatSse, parseEventCursor, parseSseBlock } from "./sse.ts"

test("formatSse writes event and json data", () => {
  const raw = formatSse("orchestrator", { channel: "orchestrator", runId: "r1" })
  assert.equal(raw, 'event: orchestrator\ndata: {"channel":"orchestrator","runId":"r1"}\n\n')
  const frames = parseSseBlock(raw)
  assert.equal(frames.length, 1)
  assert.equal(frames[0]?.event, "orchestrator")
  assert.equal(JSON.parse(frames[0]!.data).runId, "r1")
})

test("formatSse can stamp a resume id", () => {
  const raw = formatSse("orchestrator", { channel: "orchestrator", runId: "r1" }, 4)
  assert.match(raw, /^id: 4\n/)
  const frames = parseSseBlock(raw)
  assert.equal(frames[0]?.id, "4")
})

test("parseEventCursor reads Last-Event-ID and query values", () => {
  assert.equal(parseEventCursor(undefined), -1)
  assert.equal(parseEventCursor(""), -1)
  assert.equal(parseEventCursor("3"), 3)
  assert.equal(parseEventCursor("not-a-number"), -1)
})
