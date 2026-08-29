import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentTask } from "@agent-core/types"
import { emptyStatus, foldEvent, statusBarText, statusFromTasks } from "./status.js"

const task = (id: string, status: AgentTask["status"]): AgentTask => ({
  id,
  title: id,
  instructions: "",
  dependsOn: [],
  status,
})

test("maps task bags onto status bar phases", () => {
  assert.equal(statusFromTasks([]).phase, "idle")
  const running = statusFromTasks([task("a", "running"), task("b", "queued")])
  assert.equal(running.phase, "running")
  assert.equal(statusBarText(running), "Running 1 parallel")
  const verifying = statusFromTasks([task("a", "verifying"), task("b", "passed")])
  assert.equal(verifying.phase, "verifying")
  const done = statusFromTasks([task("a", "passed"), task("b", "failed")])
  assert.equal(done.phase, "done")
  assert.match(done.label, /passed/)
})

test("folds orchestrator events", () => {
  let snap = emptyStatus()
  snap = foldEvent(snap, { type: "planning" })
  assert.equal(snap.phase, "planning")
  snap = foldEvent(snap, { type: "plan_ready", tasks: [task("a", "queued"), task("b", "queued")] })
  assert.equal(snap.total, 2)
  snap = foldEvent(snap, { type: "agent_start", taskId: "a" }, [task("a", "queued"), task("b", "queued")])
  assert.equal(snap.phase, "running")
  snap = foldEvent(snap, { type: "error", message: "provider down" })
  assert.equal(snap.phase, "error")
  snap = foldEvent(snap, {
    type: "run_complete",
    results: [
      { taskId: "a", output: "ok", attempt: 1, passed: true },
      { taskId: "b", output: "no", attempt: 2, passed: false },
    ],
  })
  assert.equal(snap.phase, "done")
  assert.equal(snap.failed, 1)
})

test("usage events append token totals to the bar", () => {
  let snap = emptyStatus()
  snap = foldEvent(snap, { type: "planning" })
  snap = foldEvent(snap, { type: "usage", inputTokens: 800, outputTokens: 200, calls: 2 })
  assert.equal(snap.inputTokens, 800)
  assert.match(statusBarText(snap), /1\.0k tok/)
})

test("agent_delta keeps the bar on the writing task", () => {
  let snap = emptyStatus()
  snap = foldEvent(snap, { type: "agent_delta", taskId: "t1", text: "draft" })
  assert.equal(snap.label, "Writing t1")
})
