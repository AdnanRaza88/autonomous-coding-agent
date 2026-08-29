import type { AgentResult, AgentTask, ProviderConfig, SharedSpec } from "@agent-core/types"
import {
  addResult,
  markRunning,
  pushEvent,
  requireRecord,
  updateTask,
  wasCancelled,
} from "./blackboard.js"
import { topologicalBatches } from "./dag.js"
import type { CreateRunOptions, TaskRunner, Verifier } from "./deps.js"
import { resolveRunner } from "./deps.js"
import { appendFeedback, heuristicVerify, verifyResult } from "./verify.js"

const DEFAULT_RETRIES = 3

export class RunCancelled extends Error {
  constructor(runId: string) {
    super(`run cancelled: ${runId}`)
    this.name = "RunCancelled"
  }
}

export async function executeRun(
  runId: string,
  spec: SharedSpec,
  config: ProviderConfig,
  chat: (cfg: ProviderConfig, messages: import("@agent-core/types").ChatMessage[]) => Promise<string>,
  options?: CreateRunOptions
): Promise<void> {
  const rec = requireRecord(runId)
  markRunning(runId)
  const runner = resolveRunner(options)
  const maxRetries = clampRetries(options?.maxRetries)
  const maxBatch = Math.max(1, options?.maxBatch ?? 8)
  const verify = options?.verify ?? defaultVerifier(chat)
  const failed = new Set<string>()

  try {
    assertActive(runId)
    const batches = topologicalBatches(rec.tasks)
    for (const batch of batches) {
      assertActive(runId)
      const runnable = batch.filter((t) => !blockedByFailure(t, failed))
      for (const skipped of batch.filter((t) => blockedByFailure(t, failed))) {
        updateTask(runId, skipped.id, { status: "failed" })
        const result: AgentResult = {
          taskId: skipped.id,
          output: `skipped: dependency failed (${skipped.dependsOn.filter((d) => failed.has(d)).join(", ")})`,
          attempt: 0,
          passed: false,
        }
        addResult(runId, result)
        pushEvent(runId, { type: "agent_done", taskId: skipped.id, output: result.output })
      }
      if (runnable.length === 0) continue
      const chunks = chunk(runnable, maxBatch)
      for (const group of chunks) {
        assertActive(runId)
        await Promise.all(
          group.map((task) => runWithVerify(runId, task, spec, config, runner, verify, maxRetries, failed))
        )
      }
    }

    if (wasCancelled(runId)) {
      finishCancel(runId)
      return
    }
    const results = requireRecord(runId).results
    pushEvent(runId, { type: "run_complete", results: results.map(cloneResult) })
  } catch (err) {
    if (err instanceof RunCancelled || wasCancelled(runId)) {
      finishCancel(runId)
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    pushEvent(runId, { type: "error", message })
  }
}

export function finishCancel(runId: string, reason = "cancelled"): void {
  const rec = requireRecord(runId)
  if (rec.events.some((e) => e.type === "run_cancelled")) return
  rec.cancelled = true
  for (const task of rec.tasks) {
    if (task.status === "queued" || task.status === "running" || task.status === "retrying" || task.status === "verifying") {
      updateTask(runId, task.id, { status: "failed" })
    }
  }
  pushEvent(runId, { type: "run_cancelled", reason })
}

function assertActive(runId: string): void {
  if (wasCancelled(runId)) throw new RunCancelled(runId)
}

async function runWithVerify(
  runId: string,
  task: AgentTask,
  spec: SharedSpec,
  config: ProviderConfig,
  runner: TaskRunner,
  verify: Verifier,
  maxRetries: number,
  failed: Set<string>
): Promise<void> {
  let instructions = task.instructions
  let last: AgentResult | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    assertActive(runId)
    const status = attempt === 1 ? "running" : "retrying"
    updateTask(runId, task.id, { status, instructions })
    if (attempt === 1) pushEvent(runId, { type: "agent_start", taskId: task.id })

    const working: AgentTask = { ...task, instructions, status }
    const role = requireRecord(runId).roles.get(task.id)
    let result: AgentResult
    try {
      result = await runner(working, spec, config, attempt, role)
    } catch (err) {
      if (err instanceof RunCancelled) throw err
      result = {
        taskId: task.id,
        output: err instanceof Error ? err.message : String(err),
        attempt,
        passed: false,
      }
    }

    assertActive(runId)
    updateTask(runId, task.id, { status: "verifying" })
    const verdict = await verify(task, spec, result.output, config)
    pushEvent(runId, {
      type: "agent_verify",
      taskId: task.id,
      attempt,
      pass: verdict.pass,
      feedback: verdict.feedback,
    })

    last = { ...result, attempt, passed: verdict.pass }
    addResult(runId, last)

    if (verdict.pass) {
      updateTask(runId, task.id, { status: "passed" })
      pushEvent(runId, { type: "agent_done", taskId: task.id, output: last.output })
      return
    }

    instructions = appendFeedback(task.instructions, verdict.feedback, attempt)
  }

  updateTask(runId, task.id, { status: "failed" })
  failed.add(task.id)
  pushEvent(runId, {
    type: "agent_done",
    taskId: task.id,
    output: last?.output ?? "verification failed",
  })
}

function defaultVerifier(
  chat: (cfg: ProviderConfig, messages: import("@agent-core/types").ChatMessage[]) => Promise<string>
): Verifier {
  return async (task, spec, output, config) => {
    try {
      return await verifyResult(task, spec, output, config, chat)
    } catch {
      return heuristicVerify(task, spec, output)
    }
  }
}

function blockedByFailure(task: AgentTask, failed: Set<string>): boolean {
  return task.dependsOn.some((d) => failed.has(d))
}

function clampRetries(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_RETRIES
  return Math.min(8, Math.max(1, Math.floor(value)))
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function cloneResult(result: AgentResult): AgentResult {
  return {
    taskId: result.taskId,
    output: result.output,
    attempt: result.attempt,
    passed: result.passed,
  }
}
