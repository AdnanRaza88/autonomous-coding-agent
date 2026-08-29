import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentTask } from "@agent-core/types"
import { repairDag, topologicalBatches, validateDag } from "./dag.js"

function task(id: string, dependsOn: string[] = []): AgentTask {
  return { id, title: id, instructions: id, dependsOn, status: "queued" }
}

test("independent tasks land in one batch", () => {
  const batches = topologicalBatches([task("a"), task("b"), task("c")])
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].map((t) => t.id).sort(), ["a", "b", "c"])
})

test("dependencies form sequential batches", () => {
  const batches = topologicalBatches([
    task("t1"),
    task("t2", ["t1"]),
    task("t3", ["t1"]),
    task("t4", ["t2", "t3"]),
  ])
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[0].map((t) => t.id), ["t1"])
  assert.deepEqual(batches[1].map((t) => t.id).sort(), ["t2", "t3"])
  assert.deepEqual(batches[2].map((t) => t.id), ["t4"])
})

test("validateDag reports missing deps and cycles", () => {
  const missing = validateDag([task("t1", ["ghost"])])
  assert.equal(missing.some((i) => i.kind === "missing_dep"), true)
  const cyclic = validateDag([task("a", ["b"]), task("b", ["a"])])
  assert.equal(cyclic.some((i) => i.kind === "cycle"), true)
})

test("repairDag drops unknown edges", () => {
  const fixed = repairDag([task("t1", ["ghost"]), task("t2", ["t1"])])
  assert.deepEqual(fixed[0].dependsOn, [])
  assert.equal(validateDag(fixed).length, 0)
})
