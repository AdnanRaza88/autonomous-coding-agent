import assert from "node:assert/strict"
import { test } from "node:test"
import { assertNoPlaintextKey, maskSecrets } from "./secrets.ts"

test("maskSecrets strips apiKey after copy", () => {
  const masked = maskSecrets({ id: "groq", apiKey: "sk-live-secret", nested: { token: "abc" } })
  assert.equal(masked.apiKey, "[redacted]")
  assert.equal(masked.nested.token, "[redacted]")
  assert.equal(masked.id, "groq")
})

test("assertNoPlaintextKey rejects leftover keys", () => {
  assert.throws(() => assertNoPlaintextKey({ apiKey: "sk-1" }))
  assert.doesNotThrow(() => assertNoPlaintextKey({ apiKey: "[redacted]", model: "x" }))
})
