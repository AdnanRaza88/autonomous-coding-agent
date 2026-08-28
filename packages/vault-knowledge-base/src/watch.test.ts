import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createVault } from "./vault.js"
import { stringifyFrontmatter } from "./frontmatter.js"

test("hand-edited notes reach the Graphiti sink", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-watch-"))
  const seen: string[] = []
  const vault = createVault({
    root,
    watchDebounceMs: 30,
    sync: {
      async applyEdit(edit) {
        seen.push(edit.statement)
      },
    },
  })
  await vault.init()
  vault.startWatching()
  try {
    const dest = path.join(root, "entities", "hand-edit.md")
    await writeFile(
      dest,
      stringifyFrontmatter(
        { id: "hand-1", title: "Hand edit", kind: "entity" },
        "# Hand edit\n\nCorrected the database choice.\n",
      ),
      "utf8",
    )
    const start = Date.now()
    while (seen.length === 0 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 40))
    }
    assert.ok(seen.some((s) => /database choice/i.test(s)))
  } finally {
    vault.stopWatching()
  }
})
