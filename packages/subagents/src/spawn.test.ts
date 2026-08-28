import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  formatNeedsSubtasks,
  isNeedsSubtasks,
  parseNeedsSubtasks,
  type NeedsSubtasksSignal,
} from "./spawn.js"

const stableSignal: NeedsSubtasksSignal = {
  type: "needs_subtasks",
  reason: "Task is too broad for a single pass",
  suggestedSubtasks: [
    { title: "Design API", instructions: "Define endpoints and schemas" },
    { title: "Implement handlers", instructions: "Wire routes to services" },
  ],
}

describe("parseNeedsSubtasks", () => {
  it("parses a plain JSON signal", () => {
    const raw = JSON.stringify(stableSignal)
    const parsed = parseNeedsSubtasks(raw)
    assert.deepEqual(parsed, stableSignal)
  })

  it("parses fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify(stableSignal) + "\n```"
    const parsed = parseNeedsSubtasks(raw)
    assert.deepEqual(parsed, stableSignal)
  })

  it("parses JSON embedded in prose", () => {
    const raw =
      "I cannot finish this alone.\n" +
      JSON.stringify(stableSignal) +
      "\nPlease re-plan."
    const parsed = parseNeedsSubtasks(raw)
    assert.ok(parsed)
    assert.equal(parsed.type, "needs_subtasks")
    assert.equal(parsed.reason, stableSignal.reason)
    assert.equal(parsed.suggestedSubtasks.length, 2)
  })

  it("returns null for ordinary agent output", () => {
    assert.equal(parseNeedsSubtasks("Implemented the feature successfully."), null)
    assert.equal(parseNeedsSubtasks(""), null)
    assert.equal(parseNeedsSubtasks("{ \"type\": \"done\" }"), null)
  })

  it("fills defaults for missing reason and empty suggested list", () => {
    const parsed = parseNeedsSubtasks(
      JSON.stringify({ type: "needs_subtasks", suggestedSubtasks: [] })
    )
    assert.ok(parsed)
    assert.equal(parsed.type, "needs_subtasks")
    assert.equal(parsed.reason, "further decomposition required")
    assert.deepEqual(parsed.suggestedSubtasks, [])
  })

  it("signal shape is stable across format and parse", () => {
    const formatted = formatNeedsSubtasks(stableSignal)
    const again = parseNeedsSubtasks(formatted)
    assert.deepEqual(again, stableSignal)
    assert.equal(again?.type, "needs_subtasks")
    assert.ok(Array.isArray(again?.suggestedSubtasks))
    for (const s of again?.suggestedSubtasks ?? []) {
      assert.equal(typeof s.title, "string")
      assert.equal(typeof s.instructions, "string")
    }
  })
})

describe("isNeedsSubtasks", () => {
  it("is true only for valid signals", () => {
    assert.equal(isNeedsSubtasks(JSON.stringify(stableSignal)), true)
    assert.equal(isNeedsSubtasks("no signal here"), false)
  })
})
