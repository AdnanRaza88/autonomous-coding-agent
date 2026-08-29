import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentTask, ChatMessage, SharedSpec } from "@agent-core/types"
import {
  registerSubagentDefinition,
  runSubagent,
  getSubagentDefinition,
} from "@agent-core/subagents"
import { mockConfig } from "./helpers.ts"

test("a registered custom subagent injects its system prompt into the model call", async () => {
  registerSubagentDefinition({
    id: "style-linter",
    name: "Style linter",
    systemPromptTemplate: "You only report style violations against the house guide.",
    defaultModel: "mock",
    maxContextTokens: 8000,
    tools: [],
  })

  const stored = getSubagentDefinition("style-linter")
  assert.equal(stored?.systemPromptTemplate.includes("style violations"), true)

  const seen: ChatMessage[][] = []
  const task: AgentTask = {
    id: "t1",
    title: "Lint",
    instructions: "Review src/index.ts",
    dependsOn: [],
    status: "queued",
  }
  const spec: SharedSpec = {
    goal: "keep the house style",
    constraints: { language: "TypeScript" },
    createdAt: new Date().toISOString(),
  }

  const result = await runSubagent(task, spec, mockConfig, {
    definitionId: "style-linter",
    adapter: {
      async chat(_config, messages) {
        seen.push(messages)
        return "no violations"
      },
    },
  })

  assert.equal(result.output, "no violations")
  assert.equal(seen.length, 1)
  const system = seen[0].find((m) => m.role === "system")
  assert.ok(system)
  assert.match(system!.content, /You only report style violations against the house guide/)
  assert.match(system!.content, /keep the house style/)
})
