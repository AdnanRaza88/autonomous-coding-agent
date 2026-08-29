import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { DiffBridge } from "./diff.js"

test("opens a two-buffer proposal and accepts into the workspace file", () => {
  const root = mkdtempSync(join(tmpdir(), "ide-diff-"))
  const target = join(root, "src", "app.ts")
  writeFileSync(join(root, "keep"), "x")
  const bridge = new DiffBridge(join(root, "stage"))
  const opened = bridge.propose({
    taskId: "t1",
    workspacePath: target,
    original: "export const n = 1\n",
    proposed: "export const n = 2\n",
  })
  assert.match(opened.leftUri, /^file:\/\//)
  assert.match(opened.rightUri, /^file:\/\//)
  assert.match(opened.title, /app\.ts/)
  const applied = bridge.accept(opened.change.id)
  assert.equal(readFileSync(target, "utf8"), "export const n = 2\n")
  assert.equal(applied.workspacePath, target)
  assert.equal(bridge.list().length, 0)
})

test("reject leaves the workspace file untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "ide-diff-"))
  const target = join(root, "file.ts")
  writeFileSync(target, "old")
  const bridge = new DiffBridge(join(root, "stage"))
  const opened = bridge.propose({
    taskId: "t2",
    workspacePath: target,
    original: "old",
    proposed: "new",
  })
  bridge.reject(opened.change.id)
  assert.equal(readFileSync(target, "utf8"), "old")
})

test("unknown change ids fail closed", () => {
  const bridge = new DiffBridge()
  assert.throws(() => bridge.accept("missing"), /no pending change/)
})
