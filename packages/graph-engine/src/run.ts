import type { AgentResult, AgentTask, OrchestratorEvent, ProviderConfig, SharedSpec } from "@agent-core/types"
import {
  createRecord,
  getRecord,
  pushEvent,
  requireRecord,
  setSpec,
  setTasks,
  waitForEvent,
} from "./blackboard.js"
import type { CreateRunOptions } from "./deps.js"
import { resolveChat } from "./deps.js"
import { executeRun } from "./executor.js"
import { newRunId } from "./ids.js"
import { planTasks } from "./planner.js"
import { freezeSpec, generateSpec } from "./spec.js"

export type { CreateRunOptions }

const inflight = new Map<string, Promise<void>>()

export async function createRun(
  userGoal: string,
  providerConfig: ProviderConfig,
  options?: CreateRunOptions
): Promise<string> {
  const goal = userGoal.trim()
  if (!goal) throw new Error("userGoal is empty")

  const runId = newRunId()
  createRecord(runId)
  pushEvent(runId, { type: "planning" })

  const chat = resolveChat(providerConfig, options)

  try {
    const spec = freezeSpec(await generateSpec(goal, providerConfig, chat))
    setSpec(runId, spec)
    const planned = await planTasks(spec, providerConfig, chat)
    setTasks(runId, planned.tasks, planned.roles)
    pushEvent(runId, { type: "plan_ready", tasks: planned.tasks.map(cloneTask) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    pushEvent(runId, { type: "error", message })
    return runId
  }

  const spec = requireRecord(runId).spec
  if (!spec) {
    pushEvent(runId, { type: "error", message: "spec missing after planning" })
    return runId
  }

  const work = executeRun(runId, spec, providerConfig, chat, options)
  inflight.set(runId, work)
  void work.finally(() => inflight.delete(runId))
  return runId
}

export async function* getRunEvents(runId: string, after = -1): AsyncIterable<OrchestratorEvent> {
  const rec = getRecord(runId)
  if (!rec) throw new Error(`unknown run: ${runId}`)
  let cursor = Number.isFinite(after) ? Math.max(-1, Math.floor(after)) + 1 : 0
  while (true) {
    const current = requireRecord(runId)
    while (cursor < current.events.length) {
      yield current.events[cursor]
      cursor += 1
    }
    if (current.status === "complete" || current.status === "error") return
    await waitForEvent(runId)
  }
}

export function getRunState(runId: string): {
  spec: SharedSpec
  tasks: AgentTask[]
  results: AgentResult[]
} {
  const rec = requireRecord(runId)
  if (!rec.spec) {
    throw new Error(`run ${runId} has no spec yet`)
  }
  return {
    spec: rec.spec,
    tasks: rec.tasks.map(cloneTask),
    results: rec.results.map((r) => ({
      taskId: r.taskId,
      output: r.output,
      attempt: r.attempt,
      passed: r.passed,
    })),
  }
}

export async function waitForRun(runId: string): Promise<void> {
  const pending = inflight.get(runId)
  if (pending) await pending
  const rec = getRecord(runId)
  if (!rec) return
  while (rec.status !== "complete" && rec.status !== "error") {
    await waitForEvent(runId)
  }
}

function cloneTask(task: AgentTask): AgentTask {
  const copy: AgentTask = {
    id: task.id,
    title: task.title,
    instructions: task.instructions,
    dependsOn: [...task.dependsOn],
    status: task.status,
  }
  if (task.assignedModel) copy.assignedModel = task.assignedModel
  return copy
}
