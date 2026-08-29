import assert from "node:assert/strict"
import { test } from "node:test"
import { estimateMessageUsage, estimateUsd, mergeUsage, parseUsage } from "./usage.ts"

test("parses OpenAI, Anthropic, and Google usage shapes", () => {
  assert.deepEqual(parseUsage({ usage: { prompt_tokens: 12, completion_tokens: 4 } }), {
    inputTokens: 12,
    outputTokens: 4,
    calls: 1,
  })
  assert.deepEqual(parseUsage({ usage: { input_tokens: 20, output_tokens: 8 } }), {
    inputTokens: 20,
    outputTokens: 8,
    calls: 1,
  })
  assert.deepEqual(
    parseUsage({ usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 9 } }),
    { inputTokens: 30, outputTokens: 9, calls: 1 },
  )
  assert.equal(parseUsage({ hello: true }), undefined)
})

test("estimates from message length when the provider omits usage", () => {
  const usage = estimateMessageUsage(
    [
      { role: "system", content: "abcd" },
      { role: "user", content: "abcdefgh" },
    ],
    "xy",
  )
  assert.equal(usage.inputTokens, 3)
  assert.equal(usage.outputTokens, 1)
  assert.equal(usage.calls, 1)
})

test("rolls usage and prices from models.dev rates", () => {
  const total = mergeUsage(
    { inputTokens: 1000, outputTokens: 500, calls: 1 },
    { inputTokens: 500, outputTokens: 250, calls: 2 },
  )
  assert.deepEqual(total, { inputTokens: 1500, outputTokens: 750, calls: 3 })
  const usd = estimateUsd(total, { input: 1, output: 2 })
  assert.equal(usd, 0.003)
})
