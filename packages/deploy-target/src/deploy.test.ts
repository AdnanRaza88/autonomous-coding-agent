import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { setTargetCredentials, clearTargetCredentials } from "./config.js"
import { deployProject } from "./deploy.js"
import { DeployError } from "./errors.js"
import { resetProgressListeners, onDeployProgress } from "./progress.js"
import { registerDeployTarget, resetDeployTargets } from "./registry.js"
import { registerRun, resetRunBindings } from "./store.js"
import type { DeployProgress } from "./types.js"

describe("deployProject", () => {
  beforeEach(() => {
    resetDeployTargets()
    resetRunBindings()
    resetProgressListeners()
    clearTargetCredentials()
  })

  it("deploys through the chosen target and records progress", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-dep-"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "index.html"), "<h1>hi</h1>")
    registerRun("run-1", {
      projectDir: dir,
      spec: { goal: "static landing page", constraints: { kind: "static" }, createdAt: "2026-08-29T00:00:00.000Z" },
    })
    registerDeployTarget({
      id: "vercel",
      kind: "static",
      detect: () => true,
      deploy: async () => ({ url: "https://app.vercel.app", status: "live", targetId: "vercel" }),
    })
    const phases: string[] = []
    onDeployProgress((ev: DeployProgress) => phases.push(ev.phase))
    const result = await deployProject("run-1")
    assert.equal(result.status, "live")
    assert.equal(result.url, "https://app.vercel.app")
    assert.deepEqual(phases, ["building", "deploying", "live"])
  })

  it("fails clearly on unknown runs", async () => {
    await assert.rejects(
      () => deployProject("missing"),
      (err: unknown) => err instanceof DeployError && err.code === "unknown_run",
    )
  })

  it("surfaces target failures as failed progress", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-dep-"))
    writeFileSync(join(dir, "index.html"), "<h1>hi</h1>")
    registerRun("run-2", {
      projectDir: dir,
      spec: { goal: "site", constraints: {}, createdAt: "2026-08-29T00:00:00.000Z" },
    })
    registerDeployTarget({
      id: "vercel",
      kind: "static",
      detect: () => true,
      deploy: async () => {
        throw new DeployError({ message: "Bad or missing token for vercel (401)", code: "bad_token", targetId: "vercel" })
      },
    })
    setTargetCredentials("vercel", { token: "expired" })
    const phases: string[] = []
    onDeployProgress((ev) => phases.push(ev.phase))
    await assert.rejects(
      () => deployProject("run-2", "vercel"),
      (err: unknown) => err instanceof DeployError && err.code === "bad_token",
    )
    assert.equal(phases.at(-1), "failed")
  })

  it("reuses the same target on a second deploy", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-dep-"))
    writeFileSync(join(dir, "index.html"), "<h1>v1</h1>")
    registerRun("run-3", {
      projectDir: dir,
      spec: { goal: "site", constraints: { deploy: "vercel" }, createdAt: "2026-08-29T00:00:00.000Z" },
    })
    const seen: string[] = []
    registerDeployTarget({
      id: "vercel",
      kind: "static",
      detect: () => true,
      deploy: async (_dir, cfg) => {
        seen.push(cfg.projectName ?? "")
        return { url: "https://app.vercel.app", status: "live", targetId: "vercel" }
      },
    })
    await deployProject("run-3")
    writeFileSync(join(dir, "index.html"), "<h1>v2</h1>")
    await deployProject("run-3")
    assert.equal(seen.length, 2)
    assert.equal(seen[0], seen[1])
  })
})
