import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { runSddSubagent } from "./run.js"
import { getSddDefinition } from "./definition.js"
import { extractSharedSpec } from "./parse.js"

const config: ProviderConfig = {
  id: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "test-key",
  model: "llama-3.3-70b-versatile",
  contextWindow: 131072,
}

function scripted(replies: string[]): ProviderAdapter {
  return {
    async chat(_cfg: ProviderConfig, messages: ChatMessage[]) {
      void messages
      const next = replies.shift()
      if (next === undefined) throw new Error("unexpected extra stage call")
      return next
    },
  }
}

const constitution = [
  "# Constitution",
  "- Testing: unit tests for every public function",
  "- Style: no comments in code",
  "- Architecture: isolate modules behind public APIs",
  "- Done: tests pass and the public API matches the spec",
].join("\n")

const specDoc = [
  "# Spec",
  "Users need a local notes app.",
  "",
  "## Requirements",
  "- R1 Create a note",
  "- R2 Persist notes on disk",
  "",
  "## Non-goals",
  "- Multiplayer sync",
].join("\n")

const specWithQuestions = [
  "# Spec",
  "Users want a game.",
  "",
  "## Requirements",
  "- R1 A playable session exists",
  "",
  "## Open questions",
  "1. First-person or top-down?",
  "2. Day sky or night sky?",
].join("\n")

const planDoc = [
  "# Plan",
  "## Decisions",
  "- D1 SQLite file storage serves R2",
  "- D2 Notes module serves R1",
  "",
  "```shared-spec",
  '{"goal":"local notes app","constraints":{"persistence":"sqlite file"},"styleGuide":{"comments":"none"}}',
  "```",
].join("\n")

const tasksDoc = [
  "### t1 — schema",
  "- dependsOn: none",
  "- tracesTo: D1",
  "- instructions: create notes table. tracesTo D1",
  "- output: migration file",
  "- doNotTouch: UI",
  "",
  "### t2 — create note",
  "- dependsOn: t1",
  "- tracesTo: D2",
  "- instructions: implement createNote. tracesTo D2",
].join("\n")

const analyzeDoc = "No gaps.\nVerdict: ready"

const questionedPlan = [
  "# Plan",
  "## Open questions",
  "1. Camera style?",
  "D1 session loop serves R1",
  "```shared-spec",
  '{"goal":"game","constraints":{}}',
  "```",
].join("\n")

const questionedTasks = [
  "### t1 — session",
  "- tracesTo: D1",
  "- instructions: stub session tracesTo D1",
].join("\n")

describe("runSddSubagent", () => {
  it("runs constitution, spec, plan, tasks, analyze in order", async () => {
    const adapter = scripted([constitution, specDoc, planDoc, tasksDoc, analyzeDoc])
    const result = await runSddSubagent("local-first markdown notes app with wiki links", config, {
      adapter,
      now: () => new Date("2026-08-29T00:00:00.000Z"),
    })

    assert.match(result.constitution, /Constitution/)
    assert.match(result.spec, /R1/)
    assert.match(result.plan, /D1/)
    assert.match(result.tasks, /t1/)
    assert.equal(result.sharedSpec.goal, "local notes app")
    assert.equal(result.sharedSpec.constraints.persistence, "sqlite file")
    assert.equal(result.sharedSpec.createdAt, "2026-08-29T00:00:00.000Z")
    assert.equal(result.analysis.ready, true)
  })

  it("surfaces clarifying questions instead of inventing answers", async () => {
    const adapter = scripted([
      constitution,
      specWithQuestions,
      questionedPlan,
      questionedTasks,
      "Verdict: blocked",
    ])
    const result = await runSddSubagent("build a game", config, { adapter })
    assert.ok(result.questions.length >= 2)
    assert.ok(result.questions.some((q) => /sky|person|Camera/i.test(q.text)))
    assert.equal(result.analysis.ready, false)
  })

  it("rejects an empty goal", async () => {
    await assert.rejects(
      () => runSddSubagent("  ", config, { adapter: scripted([]) }),
      /non-empty/,
    )
  })

  it("produces a SharedSpec consumable without transformation", async () => {
    const adapter = scripted([constitution, specDoc, planDoc, tasksDoc, analyzeDoc])
    const result = await runSddSubagent("local notes with wiki links and tags", config, {
      adapter,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    })
    const spec = result.sharedSpec
    assert.equal(typeof spec.goal, "string")
    assert.equal(typeof spec.constraints, "object")
    assert.equal(typeof spec.createdAt, "string")
    const again = extractSharedSpec(result.plan, spec.goal, spec.createdAt)
    assert.equal(again.goal, spec.goal)
  })
})

describe("getSddDefinition", () => {
  it("exposes the sdd registry entry", () => {
    const def = getSddDefinition()
    assert.equal(def.id, "sdd")
    assert.match(def.systemPromptTemplate, /four gated documents/)
  })
})
