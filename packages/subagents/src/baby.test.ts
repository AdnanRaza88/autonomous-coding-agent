import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type {
  AgentTask,
  ChatMessage,
  ProviderAdapter,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import {
  BABY_MAX_CONTEXT_TOKENS,
  estimateMessageTokens,
  parseSpawnSignal,
  runBabySubagent,
  runBabySubagentDetailed,
  runSubagent,
  runSubagentDetailed,
} from "./index.js"

const baseConfig: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock-model",
  contextWindow: 8192,
}

function makeAdapter(
  onChat: (messages: ChatMessage[]) => void,
  reply: string
): ProviderAdapter {
  return {
    async chat(_config, messages) {
      onChat(messages.map((m) => ({ role: m.role, content: m.content })))
      return reply
    },
  }
}

describe("runBabySubagent", () => {
  it("never sends more than 100k tokens even when spec and instructions are huge", async () => {
    const spec: SharedSpec = {
      goal: "G".repeat(500_000),
      constraints: {
        a: "A".repeat(400_000),
        b: "B".repeat(400_000),
      },
      styleGuide: { s: "S".repeat(200_000) },
      createdAt: "2026-08-28T00:00:00.000Z",
    }
    const task: AgentTask = {
      id: "huge",
      title: "Fan out",
      instructions: "I".repeat(1_200_000),
      dependsOn: [],
      status: "queued",
    }

    let sent: ChatMessage[] = []
    const adapter = makeAdapter((msgs) => {
      sent = msgs
    }, "ok")

    const result = await runBabySubagent(task, spec, baseConfig, { adapter })
    assert.equal(result.taskId, "huge")
    assert.equal(result.output, "ok")
    assert.ok(sent.length >= 2)
    assert.ok(estimateMessageTokens(sent) <= BABY_MAX_CONTEXT_TOKENS)
  })

  it("reports truncated + tokensSent on the detailed path", async () => {
    const spec: SharedSpec = {
      goal: "goal",
      constraints: { k: "v".repeat(80_000) },
      createdAt: "2026-08-28T00:00:00.000Z",
    }
    const task: AgentTask = {
      id: "d1",
      title: "detail",
      instructions: "work".repeat(80_000),
      dependsOn: [],
      status: "queued",
    }
    const adapter = makeAdapter(() => {}, "done")
    const run = await runBabySubagentDetailed(task, spec, baseConfig, { adapter })
    assert.equal(run.passed, true)
    assert.equal(run.spawn, null)
    assert.ok(run.tokensSent <= BABY_MAX_CONTEXT_TOKENS)
    assert.ok(run.truncated)
  })
})

describe("self-spawn signaling", () => {
  it("does not recursively invoke the adapter when needs_subtasks is returned", async () => {
    let calls = 0
    const payload = JSON.stringify({
      needs_subtasks: true,
      reason: "split across packages",
      subtasks: [
        { title: "Types", instructions: "Update shared types" },
        { title: "Runner", instructions: "Wire the new signal" },
      ],
    })
    const adapter: ProviderAdapter = {
      async chat() {
        calls += 1
        return payload
      },
    }
    const task: AgentTask = {
      id: "parent",
      title: "Too big",
      instructions: "Implement the whole platform",
      dependsOn: [],
      status: "queued",
    }
    const spec: SharedSpec = {
      goal: "platform",
      constraints: {},
      createdAt: "2026-08-28T00:00:00.000Z",
    }

    const result = await runSubagent(task, spec, baseConfig, { adapter })
    const detailed = await runSubagentDetailed(task, spec, baseConfig, { adapter })

    assert.equal(calls, 2)
    assert.equal(result.taskId, "parent")
    assert.equal(result.passed, false)
    assert.equal(result.output, payload)
    assert.ok(detailed.spawn)
    assert.equal(detailed.spawn.parentTaskId, "parent")
    assert.equal(detailed.spawn.proposed.length, 2)
    const parsed = parseSpawnSignal(result.output, result.taskId)
    assert.ok(parsed)
    assert.equal(parsed.proposed[1].title, "Runner")
  })
})
