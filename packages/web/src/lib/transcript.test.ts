import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyRun, reduceRun } from "../state/events.ts"
import { buildTranscript, composeFollowUpGoal, formatTranscript, isLivePhase, isSettledPhase } from "./transcript.ts"

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

test("formatTranscript is a plain copyable thread", () => {
  let view = emptyRun()
  view = { ...view, goal: "add rate limits" }
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [{ id: "a", title: "Write limiter", instructions: "", dependsOn: [], status: "queued" }],
  })
  view = reduceRun(view, { type: "agent_done", taskId: "a", output: "token bucket in middleware" })
  view = reduceRun(view, {
    type: "run_complete",
    results: [{ taskId: "a", output: "token bucket in middleware", attempt: 1, passed: true }],
  })
  const text = formatTranscript(view)
  assert.match(text, /You/)
  assert.match(text, /add rate limits/)
  assert.match(text, /Write limiter/)
  assert.match(text, /token bucket/)
})

test("composeFollowUpGoal wraps the prior thread", () => {
  let view = emptyRun()
  view = { ...view, goal: "add rate limits" }
  view = reduceRun(view, {
    type: "plan_ready",
    tasks: [{ id: "a", title: "Write limiter", instructions: "", dependsOn: [], status: "queued" }],
  })
  view = reduceRun(view, { type: "agent_done", taskId: "a", output: "token bucket" })
  const goal = composeFollowUpGoal(view, "also log 429s")
  assert.match(goal, /Original goal/)
  assert.match(goal, /add rate limits/)
  assert.match(goal, /token bucket/)
  assert.match(goal, /also log 429s/)
})

test("composeFollowUpGoal on idle is just the message", () => {
  assert.equal(composeFollowUpGoal(emptyRun(), "  ship it  "), "ship it")
})

test("composeFollowUpGoal does not nest prior follow-ups", () => {
  const view = {
    ...emptyRun(),
    goal: "Follow-up on a prior run.\nOriginal goal:\nadd rate limits\nNew request:\nalso log 429s",
    phase: "complete" as const,
  }
  const goal = composeFollowUpGoal(view, "tighten the window")
  assert.equal((goal.match(/Original goal:/g) ?? []).length, 1)
  assert.match(goal, /add rate limits/)
  assert.match(goal, /tighten the window/)
})

test("phase helpers", () => {
  assert.equal(isLivePhase("running"), true)
  assert.equal(isLivePhase("complete"), false)
  assert.equal(isSettledPhase("cancelled"), true)
  assert.equal(isSettledPhase("planning"), false)
})
