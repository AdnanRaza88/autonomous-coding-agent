import assert from "node:assert/strict"
import { test } from "node:test"
import { getAdapter } from "@agent-core/providers"
import { clearRuns, createRun, getRunState, waitForRun } from "@agent-core/graph-engine"
import { groqConfig, ollamaConfig, scriptedAdapter, scriptedChat } from "./helpers.ts"

test("groq and local openai-compatible configs share the same adapter class", () => {
  const groq = getAdapter(groqConfig)
  const local = getAdapter(ollamaConfig)
  assert.equal(groq.constructor, local.constructor)
  assert.equal(typeof groq.chat, "function")
})

test("the same goal walks one code path across two ProviderConfigs", async () => {
  const traces: string[][] = []

  for (const config of [groqConfig, ollamaConfig]) {
    clearRuns()
    const steps: string[] = []
    const runId = await createRun("ship a cli", config, {
      adapter: scriptedAdapter({}),
      chat: scriptedChat({}),
      maxRetries: 1,
      runTask: async (task) => {
        steps.push(task.id)
        return { taskId: task.id, output: task.id, attempt: 1, passed: true }
      },
    })
    await waitForRun(runId)
    const state = getRunState(runId)
    steps.unshift(`tasks:${state.tasks.map((t) => t.id).sort().join(",")}`)
    traces.push(steps.sort())
  }

  assert.deepEqual(traces[0], traces[1])
})
