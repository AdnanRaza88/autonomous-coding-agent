import assert from "node:assert/strict"
import { test } from "node:test"
import type { OrchestratorEvent } from "@agent-core/types"
import { createLocalAutoMem } from "./local.js"
import { isRunCompleteEvent, recordRunCompleteFromEvent, summarizeRun } from "./run-complete.js"

test("summarizeRun captures asked decided outcome", () => {
  const text = summarizeRun({
    runId: "run_9",
    asked: "add memory package",
    decided: "use AutoMem + Graphiti",
    results: [
      { taskId: "a", output: "ok", attempt: 1, passed: true },
      { taskId: "b", output: "no", attempt: 2, passed: false },
    ],
  })
  assert.match(text, /Asked: add memory package/)
  assert.match(text, /Decided: use AutoMem \+ Graphiti/)
  assert.match(text, /1 passed, 1 failed/)
  assert.match(text, /Failed tasks: b/)
})

test("recordRunCompleteFromEvent stores only run_complete", async () => {
  const mem = createLocalAutoMem()
  const skip: OrchestratorEvent = { type: "planning" }
  assert.equal(await recordRunCompleteFromEvent(mem, skip), null)
  const done: OrchestratorEvent = {
    type: "run_complete",
    results: [{ taskId: "t1", output: "built", attempt: 1, passed: true }],
  }
  const stored = await recordRunCompleteFromEvent(mem, done, { goal: "remember sqlite" })
  assert.ok(stored?.id)
  const hits = await mem.recall("sqlite", 5)
  assert.ok(hits.some((h) => /remember sqlite/i.test(h.content)))
})

test("isRunCompleteEvent narrows", () => {
  assert.equal(isRunCompleteEvent({ type: "error", message: "x" }), false)
  assert.equal(isRunCompleteEvent({ type: "run_complete", results: [] }), true)
})
