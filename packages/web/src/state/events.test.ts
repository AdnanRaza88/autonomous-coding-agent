import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyRun, hydrateRun, reduceRun } from "./events.ts"

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
  assert.equal(view.cursor, 3)
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

test("run_cancelled becomes a cancelled phase", () => {
  let view = emptyRun()
  view = reduceRun(view, { type: "planning" })
  view = reduceRun(view, { type: "run_cancelled", reason: "cancelled" })
  assert.equal(view.phase, "cancelled")
  assert.equal(view.error, "cancelled")
})

test("hydrateRun rebuilds view from a snapshot", () => {
  const view = hydrateRun({
    runId: "r9",
    status: "running",
    goal: "ship cli",
    tasks: [{ id: "a", title: "A", instructions: "", dependsOn: [], status: "running" }],
    results: [],
    events: [
      { type: "planning" },
      {
        type: "plan_ready",
        tasks: [{ id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" }],
      },
      { type: "agent_start", taskId: "a" },
    ],
  })
  assert.equal(view.runId, "r9")
  assert.equal(view.goal, "ship cli")
  assert.equal(view.phase, "running")
  assert.equal(view.cursor, 2)
  assert.equal(view.tasks[0]?.status, "running")
})
