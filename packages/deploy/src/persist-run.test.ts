import assert from "node:assert/strict"
import { test } from "node:test"
import { usageFields } from "./persist-run.ts"

test("usageFields prefers live counters then disk", () => {
  const live = usageFields({ usage: { inputTokens: 10, outputTokens: 4, calls: 2 } })
  assert.deepEqual(live, { inputTokens: 10, outputTokens: 4, calls: 2, estimatedUsd: undefined })
  const disk = usageFields(undefined, { inputTokens: 3, outputTokens: 1, calls: 1, estimatedUsd: 0.002 })
  assert.equal(disk.inputTokens, 3)
  assert.equal(disk.estimatedUsd, 0.002)
})
