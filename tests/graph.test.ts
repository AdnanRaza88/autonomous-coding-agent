import assert from "node:assert/strict"
import { test } from "node:test"
import type { OrchestratorEvent } from "@agent-core/types"
import {
  clearRuns,
  createRun,
  getRunEvents,
  getRunState,
  waitForRun,
} from "@agent-core/graph-engine"
import { mockConfig, scriptedChat } from "./helpers.ts"

test("end to end run batches independent work and retries a forced fail", async () => {
  clearRuns()
  const order: string[] = []
  let verifyCalls = 0

  const runId = await createRun("Build a TypeScript CLI", mockConfig, {
    chat: scriptedChat({}),
    maxRetries: 3,
    runTask: async (task, _spec, _cfg, attempt) => {
      order.push(`${task.id}:${attempt}:start`)
      await new Promise((r) => setTimeout(r, 20))
      order.push(`${task.id}:${attempt}:end`)
      return { taskId: task.id, output: `${task.id}:${attempt}`, attempt, passed: true }
    },
    verify: async (task) => {
      if (task.id !== "t1") return { pass: true, feedback: "ok" }
      verifyCalls += 1
      if (verifyCalls < 2) return { pass: false, feedback: "missing export" }
      return { pass: true, feedback: "ok" }
    },
  })

  const types: OrchestratorEvent["type"][] = []
  for await (const event of getRunEvents(runId)) {
    types.push(event.type)
  }
  await waitForRun(runId)

  const state = getRunState(runId)
  assert.equal(state.tasks.length, 2)
  assert.ok(order.some((row) => row.startsWith("t1:")))
  assert.ok(order.some((row) => row.startsWith("t2:")))
  assert.equal(state.results.find((r) => r.taskId === "t1")?.attempt, 2)
  assert.equal(state.results.find((r) => r.taskId === "t1")?.passed, true)
  assert.ok(types.includes("planning"))
  assert.ok(types.includes("plan_ready"))
  assert.ok(types.includes("agent_verify"))
  assert.ok(types.includes("run_complete"))
})
