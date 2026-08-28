import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseSpawnSignal } from "./spawn.js"

describe("parseSpawnSignal", () => {
  it("returns null for ordinary prose", () => {
    assert.equal(parseSpawnSignal("Implemented the runner and tests.", "t1"), null)
  })

  it("reads a raw needs_subtasks object", () => {
    const raw = JSON.stringify({
      needs_subtasks: true,
      reason: "too large",
      subtasks: [
        { title: "Part A", instructions: "Do A" },
        { title: "Part B", instructions: "Do B" },
      ],
    })
    const hit = parseSpawnSignal(raw, "parent-1")
    assert.ok(hit)
    assert.equal(hit.parentTaskId, "parent-1")
    assert.equal(hit.reason, "too large")
    assert.equal(hit.proposed.length, 2)
    assert.equal(hit.proposed[0].title, "Part A")
  })

  it("reads a fenced JSON block mixed with prose", () => {
    const output = [
      "This work needs to be split.",
      "```json",
      '{"needs_subtasks":true,"reason":"split","subtasks":[{"title":"One","instructions":"Do one"}]}',
      "```",
    ].join("\n")
    const hit = parseSpawnSignal(output, "t-fence")
    assert.ok(hit)
    assert.equal(hit.proposed[0].title, "One")
  })

  it("accepts camelCase needsSubtasks and proposed alias", () => {
    const raw = JSON.stringify({
      needsSubtasks: true,
      message: "decompose",
      proposed: [{ title: "X", description: "Do X" }],
    })
    const hit = parseSpawnSignal(raw, "t2")
    assert.ok(hit)
    assert.equal(hit.reason, "decompose")
    assert.equal(hit.proposed[0].instructions, "Do X")
  })

  it("ignores JSON that is not a spawn signal", () => {
    const raw = JSON.stringify({ ok: true, files: ["a.ts"] })
    assert.equal(parseSpawnSignal(raw, "t3"), null)
  })

  it("skips malformed fences and still finds a later object", () => {
    const output = "```json\n{not json\n```\n{\"needs_subtasks\":true,\"reason\":\"ok\",\"subtasks\":[]}"
    const hit = parseSpawnSignal(output, "t4")
    assert.ok(hit)
    assert.equal(hit.reason, "ok")
  })
})
