import { writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { DeployError } from "./errors.js"
import { createVercelTarget } from "./vercel.js"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("vercel target", () => {
  it("uploads files and waits for READY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-ver-"))
    writeFileSync(join(dir, "index.html"), "<h1>ok</h1>")
    const calls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/v2/files")) {
        return new Response("{}", { status: 200 })
      }
      if (url.includes("/v13/deployments/") && !url.endsWith("/deployments")) {
        return new Response(JSON.stringify({ readyState: "READY", url: "app.vercel.app" }), { status: 200 })
      }
      if (url.includes("/v13/deployments")) {
        return new Response(JSON.stringify({ id: "dpl_1", url: "app.vercel.app" }), { status: 200 })
      }
      return new Response("nope", { status: 404 })
    }) as typeof fetch

    const target = createVercelTarget()
    const result = await target.deploy(dir, { token: "tok_test" })
    assert.equal(result.status, "live")
    assert.equal(result.url, "https://app.vercel.app")
    assert.ok(calls.some((u) => u.includes("/v2/files")))
    assert.ok(calls.some((u) => u.includes("/v13/deployments")))
  })

  it("maps 401 to bad_token", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ac-ver-"))
    writeFileSync(join(dir, "index.html"), "<h1>ok</h1>")
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "invalid token" } }), { status: 401 })) as typeof fetch
    const target = createVercelTarget({
      fetchDeployment: async () => ({ readyState: "READY", url: "https://x" }),
    })
    await assert.rejects(
      () => target.deploy(dir, { token: "bad" }),
      (err: unknown) => err instanceof DeployError && err.code === "bad_token",
    )
  })

  it("refuses a missing token before any network call", async () => {
    const target = createVercelTarget()
    await assert.rejects(
      () => target.deploy("/tmp", { token: "" }),
      (err: unknown) => err instanceof DeployError && err.code === "missing_token",
    )
  })
})
