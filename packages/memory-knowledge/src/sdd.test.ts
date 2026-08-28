import assert from "node:assert/strict"
import { test } from "node:test"
import { createLocalGraphiti } from "./local.js"
import { applyUserFactEdit, listGraphFacts } from "./facts.js"
import { ingestSddDocuments, splitForEpisode } from "./sdd.js"

test("ingestSddDocuments writes constitution spec plan as episodes", async () => {
  const g = createLocalGraphiti()
  const res = await ingestSddDocuments(g, {
    goal: "local-first coding agent",
    constitution: "Stack is TypeScript and SQLite. No cloud lock-in.",
    spec: "Subagents run isolated. SharedSpec is frozen after planning.",
    plan: "Build providers, then subagents, then memory.",
    tasks: "",
  })
  assert.ok(res.ids.length >= 4)
  assert.ok(res.skipped.includes("tasks.md"))
  const facts = await g.searchFacts("SQLite", 8)
  assert.ok(facts.some((f) => /sqlite/i.test(f.text)))
})

test("splitForEpisode chunks long markdown on headings", () => {
  const body = Array.from({ length: 20 }, (_, i) => `## Section ${i}\n${"word ".repeat(200)}`).join("\n")
  const parts = splitForEpisode(body, 800)
  assert.ok(parts.length > 1)
  assert.ok(parts.every((p) => p.length <= 800))
})

test("user fact edit is retrievable as graph content", async () => {
  const g = createLocalGraphiti()
  await ingestSddDocuments(g, { spec: "Default model is Groq llama." })
  await applyUserFactEdit(g, { statement: "Default model is Groq llama-3.3-70b", replaces: "Default model is Groq llama." })
  const listed = await listGraphFacts(g, "default model Groq", 10)
  assert.ok(listed.some((f) => /llama-3\.3-70b/i.test(f.text) || /user_edit/i.test(f.text)))
})
