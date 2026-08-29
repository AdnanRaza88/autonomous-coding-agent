import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  extractOpenQuestions,
  extractSharedSpec,
  goalLooksAmbiguous,
  parseTasksMarkdown,
  unwrapFence,
} from "./parse.js"

describe("unwrapFence", () => {
  it("strips a wrapping markdown fence", () => {
    const raw = "```markdown\n# Spec\nHello\n```"
    assert.equal(unwrapFence(raw), "# Spec\nHello")
  })

  it("leaves unfenced text alone", () => {
    assert.equal(unwrapFence("# Spec"), "# Spec")
  })
})

describe("extractSharedSpec", () => {
  it("reads a shared-spec fence", () => {
    const plan = [
      "# Plan",
      "```shared-spec",
      JSON.stringify({
        goal: "ship a local notes app",
        constraints: { testing: "unit first" },
        styleGuide: { comments: "none" },
      }),
      "```",
    ].join("\n")
    const spec = extractSharedSpec(plan, "fallback", "2026-08-29T00:00:00.000Z")
    assert.equal(spec.goal, "ship a local notes app")
    assert.equal(spec.constraints.testing, "unit first")
    assert.equal(spec.styleGuide?.comments, "none")
    assert.equal(spec.createdAt, "2026-08-29T00:00:00.000Z")
  })

  it("falls back to the user goal when the fence is missing", () => {
    const spec = extractSharedSpec("# Plan\nNo block", "build a cli", "t")
    assert.equal(spec.goal, "build a cli")
  })
})

describe("extractOpenQuestions", () => {
  it("pulls numbered items from an Open questions section", () => {
    const spec = `# Spec\n\n## Open questions\n1. Dark mode or light only?\n2. Offline required?\n`
    const qs = extractOpenQuestions(spec, "spec")
    assert.equal(qs.length, 2)
    assert.match(qs[0].text, /Dark mode/)
  })
})

describe("parseTasksMarkdown", () => {
  it("parses heading tasks with dependencies", () => {
    const md = `### t1 — scaffold package\n- dependsOn: none\n- tracesTo: D1\n- instructions: create package.json only\n- output: files\n- doNotTouch: shared/types\n\n### t2 — add runner\n- dependsOn: t1\n- tracesTo: D2\n- instructions: implement run()\n`
    const tasks = parseTasksMarkdown(md)
    assert.equal(tasks.length, 2)
    assert.equal(tasks[0].id, "t1")
    assert.deepEqual(tasks[0].dependsOn, [])
    assert.equal(tasks[1].id, "t2")
    assert.deepEqual(tasks[1].dependsOn, ["t1"])
    assert.equal(tasks[0].status, "queued")
  })
})

describe("goalLooksAmbiguous", () => {
  it("flags one-liners without domain detail", () => {
    assert.equal(goalLooksAmbiguous("build an app"), true)
    assert.equal(goalLooksAmbiguous("make a game"), true)
  })

  it("accepts a goal with product shape", () => {
    assert.equal(
      goalLooksAmbiguous("local-first markdown notes app with wiki links"),
      false
    )
  })
})
