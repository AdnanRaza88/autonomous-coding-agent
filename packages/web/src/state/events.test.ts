import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyRun, reduceRun } from "./events.ts"

test("reduces plan then parallel start events", () => {
  let view = emptyRun()
  view = reduceRun(view, { type: "planning" })
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [
      { id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" },
      { id: "b", title: "B", instructions: "", dependsOn: [], status: "queued" },
    ],
  })
  view = reduceRun(view, { type: "agent_start", taskId: "a" })
  view = reduceRun(view, { type: "agent_start", taskId: "b" })
  assert.equal(view.phase, "running")
  assert.equal(view.tasks.filter((t) => t.status === "running").length, 2)
})

test("run_complete stores results", () => {
  let view = emptyRun()
  view = reduceRun(view, {
    type: "run_complete",
    results: [{ taskId: "a", output: "ok", attempt: 1, passed: true }],
  })
  assert.equal(view.phase, "complete")
  assert.equal(view.results[0]?.output, "ok")
})
