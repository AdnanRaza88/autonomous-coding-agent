import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { clearHooks, registerHook, runHooks } from "./hooks.js"
import { revokeGrants, setPermissionHandler } from "./permission.js"

afterEach(() => {
  clearHooks()
  revokeGrants()
  setPermissionHandler(undefined)
})

test("runs hooks in registration order", async () => {
  const seen: string[] = []
  registerHook("before-task", "a", async () => {
    seen.push("a")
  })
  registerHook("before-task", "b", async () => {
    seen.push("b")
  })
  await runHooks("before-task", { point: "before-task", taskId: "t1" })
  assert.deepEqual(seen, ["a", "b"])
})

test("failed hook fires on-error then rethrows", async () => {
  const errors: string[] = []
  registerHook("before-tool-call", "boom", async () => {
    throw new Error("nope")
  })
  registerHook("on-error", "capture", async (ctx) => {
    errors.push(ctx.error ?? "")
  })
  await assert.rejects(() => runHooks("before-tool-call", { point: "before-tool-call" }))
  assert.deepEqual(errors, ["nope"])
})
