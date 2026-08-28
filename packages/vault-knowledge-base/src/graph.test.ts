import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createVault } from "./vault.js"
import { writeGraphEntities } from "./from-graph.js"

test("getVaultGraph and getBacklinks resolve wiki targets by title or id", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-graph-"))
  const vault = createVault({ root })
  await vault.init()
  await vault.writeVaultNote({
    id: "decision-sqlite",
    title: "Use SQLite",
    body: "Pick SQLite over Postgres.",
    links: [],
    properties: { kind: "decision" },
  })
  await vault.writeVaultNote({
    id: "mod-memory",
    title: "Memory package",
    body: "Stores episodes. Depends on [[Use SQLite]].",
    links: ["Use SQLite"],
    properties: { kind: "module" },
  })
  const graph = await vault.getVaultGraph()
  assert.ok(graph.nodes.some((n) => n.id === "mod-memory"))
  assert.ok(graph.edges.some((e) => e.from === "mod-memory" && e.to === "decision-sqlite"))
  const back = await vault.getBacklinks("decision-sqlite")
  assert.deepEqual(back, ["mod-memory"])
})

test("writeGraphEntities maps records into kinded notes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-ge-"))
  const vault = createVault({ root })
  await vault.init()
  const n = await writeGraphEntities((entity) => vault.writeVaultNote(entity), [
    { id: "c1", name: "No cloud lock-in", kind: "constraint", text: "Must run offline." },
  ])
  assert.equal(n, 1)
  const note = await vault.readNote("c1")
  assert.equal(note?.kind, "constraint")
  assert.match(note?.path ?? "", /^constraints\//)
})
