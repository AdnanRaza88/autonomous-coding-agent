import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { AgentTask, SharedSpec } from "@agent-core/types"
import {
  BABY_MAX_CONTEXT_TOKENS,
  BABY_OUTPUT_RESERVE_TOKENS,
  estimateMessageTokens,
  estimateTokens,
  fitToTokenBudget,
} from "./budget.js"

function huge(n: number, ch = "x"): string {
  return ch.repeat(n)
}

const task: AgentTask = {
  id: "t-budget",
  title: "Compress me",
  instructions: huge(800_000, "A"),
  dependsOn: [],
  status: "queued",
}

const spec: SharedSpec = {
  goal: huge(200_000, "G"),
  constraints: {
    language: huge(100_000, "L"),
    style: huge(100_000, "S"),
    extra: huge(100_000, "E"),
  },
  styleGuide: {
    naming: huge(80_000, "N"),
  },
  createdAt: "2026-08-28T00:00:00.000Z",
}

describe("estimateTokens", () => {
  it("is zero for empty text", () => {
    assert.equal(estimateTokens(""), 0)
  })

  it("counts four characters as one token", () => {
    assert.equal(estimateTokens("abcd"), 1)
    assert.equal(estimateTokens("abcde"), 2)
  })
})

describe("fitToTokenBudget", () => {
  it("leaves a small prompt untouched", () => {
    const smallTask: AgentTask = {
      id: "s",
      title: "tiny",
      instructions: "do it",
      dependsOn: [],
      status: "queued",
    }
    const smallSpec: SharedSpec = {
      goal: "ship",
      constraints: { lang: "ts" },
      createdAt: "2026-08-28T00:00:00.000Z",
    }
    const fit = fitToTokenBudget(smallTask, smallSpec, undefined, 8_000)
    assert.equal(fit.truncated, false)
    assert.match(fit.messages[1].content, /do it/)
    assert.match(fit.messages[0].content, /ship/)
  })

  it("fits an oversized spec and task under the baby cap", () => {
    const fit = fitToTokenBudget(
      task,
      spec,
      undefined,
      BABY_MAX_CONTEXT_TOKENS,
      BABY_OUTPUT_RESERVE_TOKENS
    )
    assert.equal(fit.truncated, true)
    assert.ok(fit.tokens <= BABY_MAX_CONTEXT_TOKENS - BABY_OUTPUT_RESERVE_TOKENS)
    assert.ok(estimateMessageTokens(fit.messages) <= BABY_MAX_CONTEXT_TOKENS)
    assert.match(fit.messages[1].content, /Task id: t-budget/)
  })

  it("never exceeds a tight custom cap", () => {
    const fit = fitToTokenBudget(task, spec, undefined, 2_000, 200)
    assert.equal(fit.truncated, true)
    assert.ok(estimateMessageTokens(fit.messages) <= 2_000)
  })
})
