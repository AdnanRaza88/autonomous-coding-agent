import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type {
  AgentTask,
  ChatMessage,
  ProviderAdapter,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import {
  runSubagent,
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
  buildMessages,
  formatSharedSpec,
} from "./index.js"
import { clearSubagentDefinitions } from "./definitions.js"
import { ensureBuiltinsRegistered } from "./builtins.js"

const baseSpec: SharedSpec = {
  goal: "Ship a reliable subagent runner",
  constraints: {
    language: "TypeScript",
    style: "no comments",
  },
  styleGuide: {
    naming: "camelCase",
  },
  createdAt: "2026-08-28T00:00:00.000Z",
}

const baseConfig: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock-model",
  contextWindow: 8192,
}

function makeTask(id: string, title: string, instructions: string): AgentTask {
  return {
    id,
    title,
    instructions,
    dependsOn: [],
    status: "queued",
  }
}

function recordingAdapter(
  onChat: (messages: ChatMessage[]) => void,
  reply: string
): ProviderAdapter {
  return {
    async chat(_config, messages) {
      onChat(messages.map((m) => ({ role: m.role, content: m.content })))
      return reply
    },
  }
}

describe("formatSharedSpec", () => {
  it("includes goal, constraints, and style guide", () => {
    const text = formatSharedSpec(baseSpec)
    assert.match(text, /Ship a reliable subagent runner/)
    assert.match(text, /language: TypeScript/)
    assert.match(text, /naming: camelCase/)
  })
})

describe("buildMessages", () => {
  it("returns isolated system + user messages with full spec", () => {
    const task = makeTask("t1", "Implement runner", "Write runSubagent")
    const messages = buildMessages(task, baseSpec)
    assert.equal(messages.length, 2)
    assert.equal(messages[0].role, "system")
    assert.equal(messages[1].role, "user")
    assert.match(messages[0].content, /Shared Project Spec/)
    assert.match(messages[0].content, /Ship a reliable subagent runner/)
    assert.match(messages[1].content, /Task id: t1/)
    assert.match(messages[1].content, /Write runSubagent/)
  })

  it("uses definition persona when provided", () => {
    const task = makeTask("t1", "Plan", "Break down the work")
    const def = {
      id: "planner",
      name: "Planner",
      systemPromptTemplate: "You are the Planner subagent for tests.",
      defaultModel: "m",
      maxContextTokens: 1000,
      tools: [] as string[],
    }
    const messages = buildMessages(task, baseSpec, def)
    assert.match(messages[0].content, /You are the Planner subagent for tests/)
    assert.match(messages[0].content, /Shared Project Spec/)
  })
})

describe("definitions registry", () => {
  it("registers builtins and lists them", () => {
    clearSubagentDefinitions()
    ensureBuiltinsRegistered()
    const list = listSubagentDefinitions()
    const ids = list.map((d) => d.id).sort()
    assert.deepEqual(ids, ["coder", "planner", "researcher", "reviewer", "tester"])
  })

  it("registerSubagentDefinition is visible via list and get", () => {
    clearSubagentDefinitions()
    ensureBuiltinsRegistered()
    registerSubagentDefinition({
      id: "custom-security",
      name: "Security",
      systemPromptTemplate: "Review for security.",
      defaultModel: "llama-3.3-70b-versatile",
      maxContextTokens: 65536,
      tools: ["read"],
    })
    const found = getSubagentDefinition("custom-security")
    assert.ok(found)
    assert.equal(found.name, "Security")
    assert.deepEqual(found.tools, ["read"])
    const listed = listSubagentDefinitions().find((d) => d.id === "custom-security")
    assert.ok(listed)
  })

  it("list returns defensive copies", () => {
    clearSubagentDefinitions()
    ensureBuiltinsRegistered()
    const a = listSubagentDefinitions()
    const b = listSubagentDefinitions()
    assert.notEqual(a, b)
    a[0].tools.push("mutated")
    const again = getSubagentDefinition(a[0].id)
    assert.ok(again)
    assert.equal(again.tools.includes("mutated"), false)
  })

  it("rejects invalid definitions", () => {
    assert.throws(() =>
      registerSubagentDefinition({
        id: "",
        name: "x",
        systemPromptTemplate: "y",
        defaultModel: "m",
        maxContextTokens: 1,
        tools: [],
      })
    )
  })
})

describe("runSubagent", () => {
  it("returns AgentResult from adapter output", async () => {
    const task = makeTask("t-run", "Run me", "Do the work")
    const adapter = recordingAdapter(() => {}, "completed output")
    const result = await runSubagent(task, baseSpec, baseConfig, { adapter })
    assert.equal(result.taskId, "t-run")
    assert.equal(result.output, "completed output")
    assert.equal(result.attempt, 1)
    assert.equal(result.passed, true)
  })

  it("injects definition when definitionId is set", async () => {
    clearSubagentDefinitions()
    ensureBuiltinsRegistered()
    let captured: ChatMessage[] = []
    const adapter = recordingAdapter((msgs) => {
      captured = msgs
    }, "ok")
    const task = makeTask("t-def", "Code it", "Implement feature X")
    await runSubagent(task, baseSpec, baseConfig, {
      adapter,
      definitionId: "coder",
    })
    assert.match(captured[0].content, /You are the Coder subagent/)
    assert.match(captured[0].content, /Shared Project Spec/)
  })

  it("10 concurrent calls with same spec never leak state", async () => {
    const seen = new Map<string, ChatMessage[]>()
    const adapter: ProviderAdapter = {
      async chat(_config, messages) {
        const taskLine = messages.find((m) => m.role === "user")?.content ?? ""
        const match = /Task id: (\S+)/.exec(taskLine)
        const id = match?.[1] ?? "unknown"
        await new Promise((r) => setTimeout(r, 5 + Math.random() * 20))
        seen.set(id, messages.map((m) => ({ role: m.role, content: m.content })))
        return `result-for-${id}`
      },
    }

    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask(`task-${i}`, `Title ${i}`, `Unique instructions for task ${i}`)
    )

    const results = await Promise.all(
      tasks.map((task) => runSubagent(task, baseSpec, baseConfig, { adapter }))
    )

    assert.equal(results.length, 10)
    for (let i = 0; i < 10; i++) {
      const id = `task-${i}`
      const result = results.find((r) => r.taskId === id)
      assert.ok(result)
      assert.equal(result.output, `result-for-${id}`)
      const msgs = seen.get(id)
      assert.ok(msgs)
      assert.match(msgs[1].content, new RegExp(`Unique instructions for task ${i}`))
      for (let j = 0; j < 10; j++) {
        if (j === i) continue
        assert.equal(
          msgs[1].content.includes(`Unique instructions for task ${j}`),
          false
        )
      }
      assert.match(msgs[0].content, /Ship a reliable subagent runner/)
    }
  })
})
