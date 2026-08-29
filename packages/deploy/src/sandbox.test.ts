import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { AuditLog } from "./audit.js"
import { DeploySecurityError } from "./errors.js"
import { createSandbox } from "./sandbox.js"

function harness() {
  const root = mkdtempSync(join(tmpdir(), "ac-box-"))
  const workspace = join(root, "workspace")
  mkdirSync(workspace)
  const audit = new AuditLog(join(root, "audit.log"))
  return { sandbox: createSandbox({ root: workspace, audit }), workspace, audit }
}

test("allows writes under the workspace and blocks parent paths", () => {
  const { sandbox, workspace } = harness()
  const inside = sandbox.assertWritable("notes/out.txt")
  assert.equal(inside.startsWith(workspace), true)
  assert.throws(() => sandbox.assertWritable("../escape.txt"), DeploySecurityError)
  assert.throws(() => sandbox.resolveInside("/etc/passwd"), DeploySecurityError)
})

test("blocks a symlink that points outside the workspace", () => {
  const { sandbox, workspace } = harness()
  const outside = join(workspace, "..", "secret")
  writeFileSync(outside, "nope")
  const link = join(workspace, "leak")
  symlinkSync(outside, link)
  assert.throws(() => sandbox.resolveInside(link), DeploySecurityError)
})

test("allowlists git and npm, denies sudo and command substitution", () => {
  const { sandbox, audit } = harness()
  const git = sandbox.allowCommand("git status")
  assert.equal(git.bin, "git")
  assert.throws(() => sandbox.allowCommand("sudo rm -rf /"), DeploySecurityError)
  assert.throws(() => sandbox.allowCommand("echo $(whoami)"), DeploySecurityError)
  const events = audit.recent()
  assert.equal(events.some((e) => e.action === "shell.exec" && e.allowed === false), true)
})

test("records denied path probes in the audit log", () => {
  const { sandbox, audit } = harness()
  try {
    sandbox.assertWritable("../../etc/shadow")
  } catch {
    void 0
  }
  const last = audit.recent().at(-1)
  assert.equal(last?.allowed, false)
  assert.match(last?.detail ?? "", /escapes/)
})
