import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyRun, reduceRun } from "../state/events.ts"
import { buildTranscript } from "./transcript.ts"

test("idle run with no goal yields no turns", () => {
  assert.deepEqual(buildTranscript(emptyRun()), [])
})

test("goal becomes the user turn", () => {
  const turns = buildTranscript({ ...emptyRun(), goal: "ship jwt auth", phase: "planning" })
  assert.equal(turns[0]?.kind, "user")
  assert.equal(turns[0] && turns[0].kind === "user" ? turns[0].text : "", "ship jwt auth")
  assert.equal(turns[1]?.kind, "status")
})

test("streaming drafts become live agent turns", () => {
  let view = emptyRun()
  view = { ...view, goal: "build cli" }
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [{ id: "a", title: "Write spec", instructions: "", dependsOn: [], status: "queued" }],
  })
  view = reduceRun(view, { type: "agent_start", taskId: "a" })
  view = reduceRun(view, { type: "agent_delta", taskId: "a", text: "Drafting" })
  const turns = buildTranscript(view)
  const agent = turns.find((t) => t.kind === "agent")
  assert.ok(agent && agent.kind === "agent")
  if (agent.kind !== "agent") return
  assert.equal(agent.text, "Drafting")
  assert.equal(agent.live, true)
  assert.equal(agent.title, "Write spec")
})

test("queued tasks without drafts stay off the thread", () => {
  let view = emptyRun()
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [
      { id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" },
      { id: "b", title: "B", instructions: "", dependsOn: ["a"], status: "queued" },
    ],
  })
  assert.equal(buildTranscript(view).filter((t) => t.kind === "agent").length, 0)
})

test("complete appends a summary status", () => {
  let view = emptyRun()
  view = { ...view, goal: "x" }
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [{ id: "a", title: "A", instructions: "", dependsOn: [], status: "queued" }],
  })
  view = reduceRun(view, { type: "agent_done", taskId: "a", output: "done" })
  view = reduceRun(view, {
    type: "run_complete",
    results: [{ taskId: "a", output: "done", attempt: 1, passed: true }],
  })
  const last = buildTranscript(view).at(-1)
  assert.equal(last?.kind, "status")
  assert.match(last && last.kind === "status" ? last.text : "", /1 of 1/)
})
