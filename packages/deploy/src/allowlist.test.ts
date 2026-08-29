import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultAllowlist, inspectCommand, tokenize } from "./allowlist.js"

test("tokenizes quotes and rejects shell metacharacters", () => {
  assert.deepEqual(tokenize('git commit -m "fix parser"'), ["git", "commit", "-m", "fix parser"])
  assert.throws(() => tokenize("echo hi; rm -rf /"))
  assert.throws(() => tokenize("cat file | less"))
})

test("inspects allowlist membership", () => {
  const allow = defaultAllowlist()
  assert.equal(inspectCommand("git diff", allow).ok, true)
  const denied = inspectCommand("curl http://169.254.169.254", allow)
  assert.equal(denied.ok, false)
})
