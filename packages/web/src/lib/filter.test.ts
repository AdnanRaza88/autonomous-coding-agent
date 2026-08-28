import assert from "node:assert/strict"
import { test } from "node:test"
import { filterCommands, parseComposer } from "./filter.ts"

test("parseComposer detects slash input", () => {
  assert.deepEqual(parseComposer("/plan src"), { slash: true, query: "plan", args: ["src"] })
  assert.equal(parseComposer("build this").slash, false)
})

test("filterCommands matches name or description", () => {
  const cmds = [
    { name: "plan", description: "Show the DAG" },
    { name: "help", description: "List commands" },
  ]
  assert.equal(filterCommands(cmds, "dag").map((c) => c.name).join(), "plan")
  assert.equal(filterCommands(cmds, "he").map((c) => c.name).join(), "help")
})
