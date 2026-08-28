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
  BABY_CONTEXT_BUDGET,
  estimateTokens,
  runBabySubagent,
} from "./index.js"

const baseConfig: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock-model",
  contextWindow: 8192,
}

function bigText(chars: number, seed = "x"): string {
  return seed.repeat(Math.ceil(chars / seed.length)).slice(0, chars)
}

describe("runBabySubagent", () => {
  it("reuses runSubagent and returns AgentResult", async () => {
    const task: AgentTask = {
      id: "baby-1",
      title: "Small",
      instructions: "Do little",
      dependsOn: [],
      status: "queued",
    }
    const spec: SharedSpec = {
      goal: "Goal",
      constraints: {},
      createdAt: "2026-08-28T00:00:00.000Z",
    }
    const adapter: ProviderAdapter = {
      async chat() {
        return "baby-done"
      },
    }
    const result = await runBabySubagent(task, spec, baseConfig, { adapter })
    assert.equal(result.taskId, "baby-1")
    assert.equal(result.output, "baby-done")
    assert.equal(result.attempt, 1)
    assert.equal(result.passed, true)
  })

  it("never sends a prompt exceeding the 100k token budget", async () => {
    let captured: ChatMessage[] = []
    const adapter: ProviderAdapter = {
      async chat(_config, messages) {
        captured = messages.map((m) => ({ role: m.role, content: m.content }))
        return "ok"
      },
    }

    const task: AgentTask = {
      id: "baby-huge",
      title: bigText(40_000, "T"),
      instructions: bigText(600_000, "I"),
      dependsOn: [],
      status: "queued",
    }
    const spec: SharedSpec = {
      goal: bigText(250_000, "G"),
      constraints: {
        a: bigText(120_000, "A"),
        b: bigText(120_000, "B"),
      },
      styleGuide: {
        s: bigText(100_000, "S"),
      },
      createdAt: "2026-08-28T00:00:00.000Z",
    }

    await runBabySubagent(task, spec, baseConfig, { adapter })

    assert.ok(captured.length >= 2)
    const total = estimateTokens(captured.map((m) => m.content).join(""))
    assert.ok(
      total <= BABY_CONTEXT_BUDGET,
      `sent ${total} tokens, budget is ${BABY_CONTEXT_BUDGET}`
    )
  })

  it("preserves task id after budget fit", async () => {
    const adapter: ProviderAdapter = {
      async chat() {
        return "x"
      },
    }
    const result = await runBabySubagent(
      {
        id: "id-must-survive",
        title: bigText(50_000),
        instructions: bigText(300_000),
        dependsOn: [],
        status: "queued",
      },
      {
        goal: bigText(200_000),
        constraints: {},
        createdAt: "2026-08-28T00:00:00.000Z",
      },
      baseConfig,
      { adapter }
    )
    assert.equal(result.taskId, "id-must-survive")
  })
})
