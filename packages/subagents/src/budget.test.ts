import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { AgentTask, SharedSpec } from "@agent-core/types"
import {
  BABY_CONTEXT_BUDGET,
  estimateTokens,
  fitToBabyBudget,
} from "./budget.js"
import { buildMessages } from "./messages.js"

function bigText(chars: number, seed = "x"): string {
  return seed.repeat(Math.ceil(chars / seed.length)).slice(0, chars)
}

const baseTask: AgentTask = {
  id: "t-budget",
  title: "Large task",
  instructions: "Do the work",
  dependsOn: [],
  status: "queued",
}

const baseSpec: SharedSpec = {
  goal: "Ship something",
  constraints: { language: "TypeScript" },
  styleGuide: { naming: "camelCase" },
  createdAt: "2026-08-28T00:00:00.000Z",
}

describe("estimateTokens", () => {
  it("is zero for empty input", () => {
    assert.equal(estimateTokens(""), 0)
  })

  it("ceil divides by four", () => {
    assert.equal(estimateTokens("abcd"), 1)
    assert.equal(estimateTokens("abcde"), 2)
  })
})

describe("fitToBabyBudget", () => {
  it("leaves small payloads under budget unchanged in substance", () => {
    const fitted = fitToBabyBudget(baseTask, baseSpec)
    assert.equal(fitted.task.id, baseTask.id)
    assert.equal(fitted.spec.goal, baseSpec.goal)
    assert.ok(fitted.estimatedTokens <= BABY_CONTEXT_BUDGET)
  })

  it("never reports estimatedTokens above the budget", () => {
    const hugeSpec: SharedSpec = {
      goal: bigText(200_000),
      constraints: {
        a: bigText(80_000),
        b: bigText(80_000),
        c: bigText(80_000),
      },
      styleGuide: {
        s1: bigText(50_000),
        s2: bigText(50_000),
      },
      createdAt: baseSpec.createdAt,
    }
    const hugeTask: AgentTask = {
      ...baseTask,
      title: bigText(20_000),
      instructions: bigText(400_000),
    }

    const fitted = fitToBabyBudget(hugeTask, hugeSpec, BABY_CONTEXT_BUDGET)
    assert.ok(fitted.estimatedTokens <= BABY_CONTEXT_BUDGET)

    const messages = buildMessages(fitted.task, fitted.spec)
    const totalChars = messages.reduce((n, m) => n + m.content.length, 0)
    const totalTokens = estimateTokens(messages.map((m) => m.content).join("\n"))
    assert.ok(totalTokens <= BABY_CONTEXT_BUDGET)
    assert.ok(totalChars / 4 <= BABY_CONTEXT_BUDGET + 500)
  })

  it("preserves task id and status under truncation", () => {
    const hugeTask: AgentTask = {
      id: "keep-me",
      title: bigText(50_000),
      instructions: bigText(300_000),
      dependsOn: ["dep-a"],
      status: "running",
      assignedModel: "mock",
    }
    const fitted = fitToBabyBudget(hugeTask, {
      goal: bigText(100_000),
      constraints: {},
      createdAt: baseSpec.createdAt,
    })
    assert.equal(fitted.task.id, "keep-me")
    assert.equal(fitted.task.status, "running")
    assert.equal(fitted.task.assignedModel, "mock")
    assert.deepEqual(fitted.task.dependsOn, ["dep-a"])
  })

  it("built messages from fitted payload stay within 100k tokens", () => {
    const fitted = fitToBabyBudget(
      {
        id: "edge",
        title: bigText(30_000, "T"),
        instructions: bigText(500_000, "I"),
        dependsOn: [],
        status: "queued",
      },
      {
        goal: bigText(200_000, "G"),
        constraints: {
          c1: bigText(100_000, "C"),
          c2: bigText(100_000, "D"),
        },
        styleGuide: { s: bigText(80_000, "S") },
        createdAt: "2026-08-28T00:00:00.000Z",
      }
    )

    const messages = buildMessages(fitted.task, fitted.spec)
    const tokens = estimateTokens(messages.map((m) => m.content).join(""))
    assert.ok(
      tokens <= BABY_CONTEXT_BUDGET,
      `tokens ${tokens} exceeded budget ${BABY_CONTEXT_BUDGET}`
    )
  })
})
