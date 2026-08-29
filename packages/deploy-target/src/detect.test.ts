import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { detectProjectKind } from "./detect.js"
import type { SharedSpec } from "@agent-core/types"

function spec(goal: string, constraints: Record<string, string> = {}): SharedSpec {
  return { goal, constraints, createdAt: "2026-08-29T00:00:00.000Z" }
}

describe("detectProjectKind", () => {
  it("honors constraints.kind", () => {
    const found = detectProjectKind(spec("anything", { kind: "static-site" }))
    assert.equal(found.kind, "static")
  })

  it("honors fullstack constraint", () => {
    const found = detectProjectKind(spec("shop", { stack: "fullstack-node" }))
    assert.equal(found.kind, "container")
  })

  it("reads goal language", () => {
    const found = detectProjectKind(spec("Build a landing page with Vite"))
    assert.equal(found.kind, "static")
  })

  it("reads backend goal language", () => {
    const found = detectProjectKind(spec("Express API with Postgres"))
    assert.equal(found.kind, "container")
  })

  it("inspects Dockerfile on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-detect-"))
    writeFileSync(join(dir, "Dockerfile"), "FROM node:20\n")
    const found = detectProjectKind(spec("misc project"), dir)
    assert.equal(found.kind, "container")
  })

  it("inspects package.json server deps", () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-detect-"))
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "api", dependencies: { fastify: "^5.0.0" } }),
    )
    const found = detectProjectKind(spec("workspace"), dir)
    assert.equal(found.kind, "container")
    assert.equal(found.framework, "fastify")
  })

  it("treats index.html as static", () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-detect-"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "index.html"), "<html></html>")
    const found = detectProjectKind(spec("workspace"), dir)
    assert.equal(found.kind, "static")
  })
})
