import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentTask } from "@agent-core/types"
import { topologicalBatches } from "./dag.ts"

function t(id: string, dependsOn: string[]): AgentTask {
  return { id, title: id, instructions: id, dependsOn, status: "queued" }
}

test("groups independent tasks into one batch", () => {
  const batches = topologicalBatches([t("a", []), t("b", []), t("c", ["a", "b"])])
  assert.deepEqual(
    batches.map((b) => b.map((x) => x.id)),
    [
      ["a", "b"],
      ["c"],
    ]
  )
})

test("breaks cycles by forcing one node", () => {
  const batches = topologicalBatches([t("a", ["b"]), t("b", ["a"])])
  assert.equal(batches.flat().length, 2)
})
