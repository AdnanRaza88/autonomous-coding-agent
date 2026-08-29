import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { AgentTask, ProviderAdapter, ProviderConfig, SharedSpec } from "@agent-core/types"
import { runSubagent } from "./run.js"

const spec: SharedSpec = {
  goal: "stream",
  constraints: {},
  createdAt: "2026-08-30T00:00:00.000Z",
}

const config: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock",
  contextWindow: 8192,
}

describe("runSubagent onDelta", () => {
  it("forwards the adapter reply as one chunk", async () => {
    const chunks: string[] = []
    const adapter: ProviderAdapter = {
      async chat() {
        return "hello from worker"
      },
    }
    const task: AgentTask = {
      id: "t-delta",
      title: "Draft",
      instructions: "Write",
      dependsOn: [],
      status: "queued",
    }
    const result = await runSubagent(task, spec, config, {
      adapter,
      onDelta: (text) => chunks.push(text),
    })
    assert.equal(result.output, "hello from worker")
    assert.deepEqual(chunks, ["hello from worker"])
  })
})
