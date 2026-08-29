import type { AgentResult, AgentTask, OrchestratorEvent, ProviderConfig, SharedSpec } from "@agent-core/types"
import {
  addUsage,
  createRecord,
  getRecord,
  isTerminal,
  listRecords,
  pushEvent,
  requestCancel,
  requireRecord,
  setSpec,
  setTasks,
  waitForEvent,
} from "./blackboard.js"
import { estimateMessageUsage } from "@agent-core/providers"
import type { CreateRunOptions } from "./deps.js"
import { resolveChat } from "./deps.js"
import { executeRun, finishCancel } from "./executor.js"
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

  const chat = meterChat(runId, resolveChat(providerConfig, options))

  try {
    const spec = freezeSpec(await generateSpec(goal, providerConfig, chat))
    setSpec(runId, spec)
    const planned = await planTasks(spec, providerConfig, chat)
    setTasks(runId, planned.tasks, planned.roles)
    pushEvent(runId, { type: "plan_ready", tasks: planned.tasks.map(cloneTask) })
  } catch (err) {
    if (getRecord(runId)?.cancelled) {
      finishCancel(runId)
      return runId
    }
    const message = err instanceof Error ? err.message : String(err)
    pushEvent(runId, { type: "error", message })
    return runId
  }

  if (getRecord(runId)?.cancelled) {
    finishCancel(runId)
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

export function cancelRun(runId: string, reason = "cancelled"): boolean {
  const rec = getRecord(runId)
  if (!rec) return false
  if (isTerminal(rec.status)) return false
  requestCancel(runId)
  if (!inflight.has(runId)) finishCancel(runId, reason)
  return true
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
    if (isTerminal(current.status)) return
    await waitForEvent(runId)
  }
}

export function getRunState(runId: string): {
  spec: SharedSpec | null
  tasks: AgentTask[]
  results: AgentResult[]
  status: string
  usage: { inputTokens: number; outputTokens: number; calls: number }
} {
  const rec = requireRecord(runId)
  return {
    spec: rec.spec,
    tasks: rec.tasks.map(cloneTask),
    results: rec.results.map((r) => ({
      taskId: r.taskId,
      output: r.output,
      attempt: r.attempt,
      passed: r.passed,
    })),
    status: rec.status,
    usage: { ...rec.usage },
  }
}

export function listRuns(): Array<{
  id: string
  status: string
  createdAt: number
  goal?: string
  usage?: { inputTokens: number; outputTokens: number; calls: number }
}> {
  return listRecords().map((rec) => ({
    id: rec.id,
    status: rec.status,
    createdAt: rec.createdAt,
    goal: rec.spec?.goal,
    usage: { ...rec.usage },
  }))
}

export async function waitForRun(runId: string): Promise<void> {
  const pending = inflight.get(runId)
  if (pending) await pending
  const rec = getRecord(runId)
  if (!rec) return
  while (!isTerminal(rec.status)) {
    await waitForEvent(runId)
  }
}

function meterChat(
  runId: string,
  chat: (config: ProviderConfig, messages: import("@agent-core/types").ChatMessage[]) => Promise<string>,
): (config: ProviderConfig, messages: import("@agent-core/types").ChatMessage[]) => Promise<string> {
  return async (config, messages) => {
    const text = await chat(config, messages)
    addUsage(runId, estimateMessageUsage(messages, text))
    return text
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
