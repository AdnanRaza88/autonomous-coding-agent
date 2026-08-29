import assert from "node:assert/strict"
import { test } from "node:test"
import type { ChatMessage, OrchestratorEvent, ProviderConfig } from "@agent-core/types"
import { clearRuns } from "./blackboard.js"
import { createRun, getRunEvents, waitForRun } from "./run.js"

const config: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock",
  contextWindow: 8192,
}

function chat(replies: Record<string, string>) {
  return async (_c: ProviderConfig, messages: ChatMessage[]) => {
    const blob = messages.map((m) => m.content).join("\n")
    if (blob.includes("You write a SharedSpec")) {
      return replies.spec ?? '{"goal":"ship","constraints":{}}'
    }
    if (blob.includes("You are the planner")) {
      return (
        replies.plan ??
        JSON.stringify({
          tasks: [{ id: "t1", title: "A", instructions: "do A", dependsOn: [], role: "coder" }],
        })
      )
    }
    return replies.default ?? "done"
  }
}

test("default runner publishes onDelta frames from the worker adapter", async () => {
  clearRuns()
  const runId = await createRun("live tokens", config, {
    chat: chat({}),
    maxRetries: 1,
    adapter: {
      async chat() {
        return "live draft body"
      },
    },
    verify: async () => ({ pass: true, feedback: "ok" }),
  })
  await waitForRun(runId)
  const events: OrchestratorEvent[] = []
  for await (const event of getRunEvents(runId)) events.push(event)
  const deltas = events.filter((e) => e.type === "agent_delta")
  assert.ok(deltas.length >= 1)
  assert.ok(deltas.some((e) => e.type === "agent_delta" && e.text === "live draft body"))
  const startAt = events.findIndex((e) => e.type === "agent_start")
  const verifyAt = events.findIndex((e) => e.type === "agent_verify")
  const deltaAt = events.findIndex((e) => e.type === "agent_delta")
  assert.ok(startAt >= 0 && deltaAt > startAt && deltaAt < verifyAt)
})
