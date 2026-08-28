import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { analyzeDocuments } from "./analyze.js"

describe("analyzeDocuments", () => {
  it("passes when tasks trace to plan decisions that cite spec requirements", () => {
    const report = analyzeDocuments({
      constitution: "No comments in code. Tests required.",
      spec: "## Requirements\nR1 Users can create a note.\nR2 Notes persist locally.",
      plan: "## Decisions\nD1 SQLite storage (R2)\nD2 Note editor module (R1)",
      tasks: `### t1 — storage\n- dependsOn: none\n- tracesTo: D1\n- instructions: add sqlite schema for notes. tracesTo D1\n### t2 — editor\n- dependsOn: t1\n- tracesTo: D2\n- instructions: build editor. tracesTo D2\n`,
    })
    assert.equal(report.ready, true)
    assert.equal(report.gaps.length, 0)
  })

  it("flags a task with no plan trace", () => {
    const report = analyzeDocuments({
      constitution: "ok",
      spec: "R1 login",
      plan: "D1 auth module serves R1",
      tasks: `### t1 — mystery\n- dependsOn: none\n- instructions: do something vague\n`,
    })
    assert.equal(report.ready, false)
    assert.ok(report.gaps.some((g) => g.kind === "task_missing_trace"))
  })

  it("flags a dangling dependency", () => {
    const report = analyzeDocuments({
      constitution: "ok",
      spec: "R1 x",
      plan: "D1 does R1",
      tasks: `### t1 — a\n- dependsOn: t9\n- tracesTo: D1\n- instructions: work tracesTo D1\n`,
    })
    assert.ok(report.gaps.some((g) => g.kind === "dangling_dependency"))
  })
})
