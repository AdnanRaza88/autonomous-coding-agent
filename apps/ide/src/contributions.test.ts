import assert from "node:assert/strict"
import { test } from "node:test"
import { extensionManifest, sidebarHtml, slashCount } from "./contributions.js"
import { nextTheme, themeForKind } from "./theme.js"

test("manifest is additive and lists slash plus host commands", () => {
  const manifest = extensionManifest()
  const contributes = manifest.contributes as {
    viewsContainers: { activitybar: Array<{ id: string }> }
    commands: Array<{ command: string }>
    themes: Array<{ id: string }>
  }
  assert.equal(contributes.viewsContainers.activitybar[0].id, "agent-core")
  assert.ok(contributes.commands.some((c) => c.command === "agent-core.openSidebar"))
  assert.ok(slashCount() >= 50)
  assert.ok(contributes.themes.some((t) => t.id === "agent-core-light"))
  assert.ok(contributes.themes.some((t) => t.id === "agent-core-dark"))
})

test("sidebar html points the iframe at the loopback origin", () => {
  const html = sidebarHtml("http://127.0.0.1:17300/abc/")
  assert.match(html, /iframe/)
  assert.match(html, /127\.0\.0\.1:17300/)
  assert.match(html, /frame-src http:\/\/127\.0\.0\.1:\*/)
})

test("theme toggle flips the pair", () => {
  assert.equal(themeForKind("light").id, "agent-core-light")
  assert.equal(nextTheme("agent-core-light").id, "agent-core-dark")
  assert.equal(nextTheme("agent-core-dark").id, "agent-core-light")
})
