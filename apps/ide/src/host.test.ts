import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createIdeHost } from "./host.js"
import { encodeWorkspaceKey } from "./workspace.js"

test("host wires serve manager, proxy, and sidebar iframe", async () => {
  const spa = mkdtempSync(join(tmpdir(), "ide-host-spa-"))
  writeFileSync(join(spa, "index.html"), "<html>ui</html>")
  const host = await createIdeHost({
    spaRoot: spa,
    workspace: "/tmp/proj",
    preferredPort: 39510,
    proxyPort: 0,
    readyTimeoutMs: 400,
    probeIntervalMs: 20,
    spawn: () => ({ pid: 99, kill: () => true }),
    probe: async () => true,
  })
  try {
    assert.equal(host.serve.state, "healthy")
    assert.equal(host.sidebar.workspaceKey, encodeWorkspaceKey("/tmp/proj"))
    assert.ok(host.sidebar.iframeUrl.startsWith(host.proxy.origin))
    const page = await fetch(host.sidebar.iframeUrl)
    assert.match(await page.text(), /ui/)
    assert.match(host.html, /iframe/)
    const cmds = (host.manifest.contributes as { commands: Array<{ command: string }> }).commands
    assert.ok(cmds.some((c) => c.command === "agent-core.slash.plan"))
  } finally {
    await host.stop()
  }
})
