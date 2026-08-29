import { writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { DeployError } from "./errors.js"
import { createFlyTarget } from "./fly.js"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("fly target", () => {
  it("creates an app when missing then launches a machine", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-fly-"))
    writeFileSync(join(dir, "Dockerfile"), "FROM node:20\n")
    const paths: string[] = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      paths.push(`${init?.method ?? "GET"} ${url}`)
      if (url.endsWith("/apps/ac-app") && (!init?.method || init.method === "GET")) {
        return new Response("missing", { status: 404 })
      }
      if (url.endsWith("/apps") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "ac-app" }), { status: 200 })
      }
      if (url.includes("/machines") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "m1" }), { status: 200 })
      }
      return new Response("{}", { status: 200 })
    }) as typeof fetch

    const target = createFlyTarget()
    const result = await target.deploy(dir, { token: "fly_tok", projectName: "ac-app" })
    assert.equal(result.status, "live")
    assert.equal(result.url, "https://ac-app.fly.dev")
    assert.ok(paths.some((p) => p.includes("/apps") && p.startsWith("POST")))
    assert.ok(paths.some((p) => p.includes("/machines")))
  })

  it("maps unauthorized fly tokens", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-fly-"))
    writeFileSync(join(dir, "Dockerfile"), "FROM node:20\n")
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })) as typeof fetch
    await assert.rejects(
      () => createFlyTarget().deploy(dir, { token: "nope", projectName: "x" }),
      (err: unknown) => err instanceof DeployError && err.code === "bad_token",
    )
  })
})
