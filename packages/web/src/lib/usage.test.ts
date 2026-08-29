import assert from "node:assert/strict"
import { test } from "node:test"
import { formatTokens, formatUsd } from "./usage.ts"

test("formatTokens stays quiet when empty", () => {
  assert.equal(formatTokens(), "")
  assert.equal(formatTokens(12, 8, 1), "20 tok · 1 call")
  assert.equal(formatTokens(1200, 0, 2), "1.2k tok · 2 calls")
})

test("formatUsd hides zeros", () => {
  assert.equal(formatUsd(undefined), "")
  assert.equal(formatUsd(0), "")
  assert.equal(formatUsd(0.0042), "$0.0042")
})
