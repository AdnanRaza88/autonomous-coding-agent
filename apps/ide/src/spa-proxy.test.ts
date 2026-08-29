import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { startSpaProxy } from "./spa-proxy.js"
import { encodeWorkspaceKey } from "./workspace.js"
import { LOOPBACK } from "./ports.js"

function spaDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ide-spa-"))
  writeFileSync(join(dir, "index.html"), "<html><body>agent</body></html>")
  writeFileSync(join(dir, "app.js"), "window.__agent=1")
  return dir
}

test("serves spa under workspace key and keeps origin stable", async () => {
  const root = spaDir()
  const backend = createServer((req, res) => {
    res.setHeader("content-type", "application/json")
    res.setHeader("x-frame-options", "DENY")
    res.end(JSON.stringify({ ok: true, path: req.url }))
  })
  await new Promise<void>((r) => backend.listen(0, LOOPBACK, () => r()))
  const addr = backend.address()
  const bport = typeof addr === "object" && addr ? addr.port : 0
  const workspace = "/tmp/demo-workspace"
  const proxy = await startSpaProxy({
    spaRoot: root,
    backendOrigin: `http://${LOOPBACK}:${bport}`,
    workspace,
    port: 0,
  })
  try {
    const url = proxy.iframeUrl(workspace)
    assert.ok(url.startsWith(proxy.origin + "/"))
    assert.ok(url.includes(encodeWorkspaceKey(workspace)))
    const page = await fetch(url)
    const html = await page.text()
    assert.match(html, /agent/)
    assert.equal(page.headers.get("x-frame-options"), null)
    assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors/)

    const asset = await fetch(`${proxy.origin}/${encodeWorkspaceKey(workspace)}/app.js`)
    assert.equal(await asset.text(), "window.__agent=1")

    const api = await fetch(`${proxy.origin}/${encodeWorkspaceKey(workspace)}/api/health`)
    const body = (await api.json()) as { ok: boolean; path: string }
    assert.equal(body.ok, true)
    assert.equal(body.path, "/api/health")
  } finally {
    await proxy.close()
    await new Promise<void>((r) => backend.close(() => r()))
  }
})

test("rejects missing spa root", async () => {
  await assert.rejects(
    () => startSpaProxy({ spaRoot: join(tmpdir(), "missing-spa-xyz"), backendOrigin: "http://127.0.0.1:1" }),
    /index.html not found/,
  )
})

test("unknown paths fall back to the spa shell", async () => {
  const root = spaDir()
  const proxy = await startSpaProxy({ spaRoot: root, backendOrigin: "http://127.0.0.1:1", port: 0 })
  try {
    const res = await fetch(`${proxy.origin}/not-a-real-asset.js`)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /agent/)
  } finally {
    await proxy.close()
  }
})
