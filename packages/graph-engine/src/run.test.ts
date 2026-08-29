import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  AgentResult,
  AgentTask,
  ChatMessage,
  OrchestratorEvent,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import { clearRuns } from "./blackboard.js"
import { cancelRun, createRun, getRunEvents, getRunState, waitForRun } from "./run.js"

const config: ProviderConfig = {
  id: "mock",
  baseUrl: "http://localhost",
  apiKey: "test",
  model: "mock",
  contextWindow: 8192,
}

function chatScript(replies: Record<string, string>): (c: ProviderConfig, m: ChatMessage[]) => Promise<string> {
  return async (_c, messages) => {
    const blob = messages.map((m) => m.content).join("\n")
    if (blob.includes("You write a SharedSpec")) {
      return replies.spec ?? `{\"goal\":\"ship a cli\",\"constraints\":{\"language\":\"TypeScript\"},\"styleGuide\":{\"theme\":\"light\"}}`
    }
    if (blob.includes("You are the planner")) {
      return replies.plan ?? JSON.stringify({
        tasks: [
          {
            id: "t1",
            title: "Build parser",
            instructions: "Write the parser. Expected output: source. Do not touch the CLI entry.",
            dependsOn: [],
            role: "coder",
          },
          {
            id: "t2",
            title: "Build CLI",
            instructions: "Write the CLI. Expected output: source. Do not touch the parser.",
            dependsOn: [],
            role: "coder",
          },
        ],
      })
    }
    if (blob.includes("You are a black-box verifier")) {
      return replies.verify ?? `{\"pass\":true,\"feedback\":\"ok\"}`
    }
    return replies.default ?? "done"
  }
}

test("createRun produces a spec and task DAG before returning", async () => {
  clearRuns()
  const runId = await createRun("Build a TypeScript CLI with a light theme", config, {
    chat: chatScript({}),
    runTask: async (task) => ({ taskId: task.id, output: `done ${task.id}`, attempt: 1, passed: true }),
    maxRetries: 1,
  })
  const state = getRunState(runId)
  assert.equal(state.spec!.goal.length > 0, true)
  assert.ok(state.spec?.styleGuide?.theme === "light" || state.spec?.constraints.language === "TypeScript")
  assert.equal(state.tasks.length, 2)
  assert.deepEqual(state.tasks.map((t) => t.id).sort(), ["t1", "t2"])
  await waitForRun(runId)
})

test("independent tasks in a batch actually overlap in time", async () => {
  clearRuns()
  const starts: Record<string, number> = {}
  const ends: Record<string, number> = {}
  const runId = await createRun("parallel work", config, {
    chat: chatScript({}),
    maxRetries: 1,
    runTask: async (task) => {
      starts[task.id] = Date.now()
      await new Promise((r) => setTimeout(r, 80))
      ends[task.id] = Date.now()
      return { taskId: task.id, output: task.id, attempt: 1, passed: true }
    },
  })
  await waitForRun(runId)
  assert.ok(starts.t1 && starts.t2)
  assert.equal(starts.t1 < ends.t2 && starts.t2 < ends.t1, true)
})

test("failing verifier retries with feedback appended", async () => {
  clearRuns()
  const seen: string[] = []
  let verifyCalls = 0
  const runId = await createRun("retry path", config, {
    chat: chatScript({
      plan: JSON.stringify({
        tasks: [
          {
            id: "t1",
            title: "One unit",
            instructions: "Produce the module.",
            dependsOn: [],
            role: "coder",
          },
        ],
      }),
    }),
    maxRetries: 3,
    runTask: async (task, _spec, _cfg, attempt) => {
      seen.push(task.instructions)
      return { taskId: task.id, output: `attempt-${attempt}`, attempt, passed: false }
    },
    verify: async () => {
      verifyCalls += 1
      if (verifyCalls < 3) return { pass: false, feedback: "missing export" }
      return { pass: true, feedback: "ok" }
    },
  })
  await waitForRun(runId)
  const state = getRunState(runId)
  assert.equal(state.results[0].passed, true)
  assert.equal(state.results[0].attempt, 3)
  assert.equal(seen.length, 3)
  assert.equal(seen[0].includes("Verifier feedback"), false)
  assert.equal(seen[1].includes("missing export"), true)
  assert.equal(seen[2].includes("missing export"), true)
  assert.equal(verifyCalls, 3)
})

test("getRunEvents yields every state transition", async () => {
  clearRuns()
  const runId = await createRun("event stream", config, {
    chat: chatScript({
      plan: JSON.stringify({
        tasks: [
          { id: "t1", title: "A", instructions: "do A", dependsOn: [], role: "coder" },
        ],
      }),
    }),
    maxRetries: 1,
    runTask: async (task): Promise<AgentResult> => ({
      taskId: task.id,
      output: "ok",
      attempt: 1,
      passed: true,
    }),
  })
  const types: OrchestratorEvent["type"][] = []
  for await (const event of getRunEvents(runId)) {
    types.push(event.type)
  }
  assert.ok(types.includes("usage"))
  assert.deepEqual(
    types.filter((t) => t !== "usage"),
    ["planning", "plan_ready", "agent_start", "agent_verify", "agent_done", "run_complete"],
  )
  const state = getRunState(runId)
  assert.ok(state.usage.calls >= 2)
  assert.ok(state.usage.inputTokens > 0)
  assert.ok(state.usage.outputTokens > 0)
})

test("getRunEvents after a cursor skips already seen frames", async () => {
  clearRuns()
  const runId = await createRun("resume stream", config, {
    chat: chatScript({
      plan: JSON.stringify({
        tasks: [{ id: "t1", title: "A", instructions: "do A", dependsOn: [], role: "coder" }],
      }),
    }),
    maxRetries: 1,
    runTask: async (task): Promise<AgentResult> => ({
      taskId: task.id,
      output: "ok",
      attempt: 1,
      passed: true,
    }),
  })
  await waitForRun(runId)
  const all: OrchestratorEvent["type"][] = []
  for await (const event of getRunEvents(runId)) all.push(event.type)
  const readyAt = all.indexOf("plan_ready")
  assert.ok(readyAt >= 0)
  const rest: OrchestratorEvent["type"][] = []
  for await (const event of getRunEvents(runId, readyAt)) {
    rest.push(event.type)
  }
  assert.deepEqual(
    rest.filter((t) => t !== "usage"),
    ["agent_start", "agent_verify", "agent_done", "run_complete"],
  )
})

test("same SharedSpec object is passed to every worker", async () => {
  clearRuns()
  const seen: SharedSpec[] = []
  const runId = await createRun("shared spec identity", config, {
    chat: chatScript({}),
    maxRetries: 1,
    runTask: async (task: AgentTask, spec) => {
      seen.push(spec)
      return { taskId: task.id, output: "ok", attempt: 1, passed: true }
    },
  })
  await waitForRun(runId)
  assert.equal(seen.length, 2)
  assert.equal(seen[0], seen[1])
})

test("failed dependency skips dependents", async () => {
  clearRuns()
  const runId = await createRun("skip chain", config, {
    chat: chatScript({
      plan: JSON.stringify({
        tasks: [
          { id: "t1", title: "Root", instructions: "fail", dependsOn: [], role: "coder" },
          { id: "t2", title: "Child", instructions: "depends", dependsOn: ["t1"], role: "coder" },
        ],
      }),
    }),
    maxRetries: 1,
    runTask: async (task) => ({
      taskId: task.id,
      output: task.id,
      attempt: 1,
      passed: false,
    }),
    verify: async (task) =>
      task.id === "t1" ? { pass: false, feedback: "no" } : { pass: true, feedback: "ok" },
  })
  await waitForRun(runId)
  const state = getRunState(runId)
  const child = state.results.find((r) => r.taskId === "t2")
  assert.ok(child)
  assert.equal(child?.passed, false)
  assert.match(child?.output ?? "", /skipped/)
})

test("empty goal is rejected", async () => {
  await assert.rejects(() => createRun("   ", config), /empty/)
})

test("cancelRun stops remaining work and emits run_cancelled", async () => {
  clearRuns()
  let started = 0
  const gate = new Promise<void>((resolve) => {
    setTimeout(resolve, 30)
  })
  const runId = await createRun("abort mid flight", config, {
    chat: chatScript({
      plan: JSON.stringify({
        tasks: [
          { id: "t1", title: "Slow", instructions: "sleep", dependsOn: [], role: "coder" },
          { id: "t2", title: "After", instructions: "later", dependsOn: ["t1"], role: "coder" },
        ],
      }),
    }),
    maxRetries: 1,
    runTask: async (task) => {
      started += 1
      await gate
      await new Promise((r) => setTimeout(r, 80))
      return { taskId: task.id, output: task.id, attempt: 1, passed: true }
    },
  })
  assert.equal(cancelRun(runId), true)
  await waitForRun(runId)
  const state = getRunState(runId)
  assert.equal(state.status, "cancelled")
  const types: string[] = []
  for await (const event of getRunEvents(runId)) types.push(event.type)
  assert.ok(types.includes("run_cancelled"))
  assert.equal(types.includes("run_complete"), false)
  assert.ok(started <= 1)
})
