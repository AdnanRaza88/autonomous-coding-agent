import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyRun, reduceRun } from "../state/events.ts"
import { planProgress } from "./plan.ts"

test("planning with no tasks reports planning", () => {
  const view = { ...emptyRun(), goal: "x", phase: "planning" as const }
  assert.equal(planProgress(view).line, "Planning the work.")
  assert.equal(planProgress(view).total, 0)
})

test("batches and live counts follow the DAG", () => {
  let view = emptyRun()
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [
      { id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" },
      { id: "b", title: "B", instructions: "", dependsOn: [], status: "queued" },
      { id: "c", title: "C", instructions: "", dependsOn: ["a", "b"], status: "queued" },
    ],
  })
  const planned = planProgress(view)
  assert.equal(planned.batches.length, 2)
  assert.equal(planned.batches[0].length, 2)
  assert.equal(planned.queued, 3)
  assert.match(planned.line, /0 of 3 passed/)

  view = reduceRun(view, { type: "agent_start", taskId: "a" })
  view = reduceRun(view, { type: "agent_start", taskId: "b" })
  const live = planProgress(view)
  assert.equal(live.live.length, 2)
  assert.equal(live.activeBatch, 0)
  assert.match(live.line, /2 live in batch 1 · parallel/)
})

test("complete run keeps batch structure", () => {
  let view = emptyRun()
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [{ id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" }],
  })
  view = reduceRun(view, { type: "agent_done", taskId: "a", output: "ok" })
  view = reduceRun(view, {
    type: "run_complete",
    results: [{ taskId: "a", output: "ok", attempt: 1, passed: true }],
  })
  const done = planProgress(view)
  assert.equal(done.passed, 1)
  assert.equal(done.live.length, 0)
  assert.match(done.line, /1 of 1 passed/)
})
