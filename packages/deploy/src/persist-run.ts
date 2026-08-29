import type { Runtime } from "./bootstrap.js"
import { getRecord } from "@agent-core/graph-engine"
import { getMemoryLayer } from "@agent-core/memory-knowledge"
import { rememberCompletedRun } from "./knowledge-plane.js"

export function persistRun(runtime: Runtime, runId: string, goalHint?: string): void {
  const rec = getRecord(runId)
  const prev = runtime.store.getRun(runId)
  runtime.store.upsertRun({
    id: runId,
    goal: goalHint ?? prev?.goal ?? rec?.spec?.goal ?? "",
    status: rec?.status ?? prev?.status ?? "planning",
    createdAt: prev?.createdAt ?? new Date(rec?.createdAt ?? Date.now()).toISOString(),
    providerId: prev?.providerId,
    model: prev?.model,
    inputTokens: rec?.usage.inputTokens ?? prev?.inputTokens,
    outputTokens: rec?.usage.outputTokens ?? prev?.outputTokens,
    calls: rec?.usage.calls ?? prev?.calls,
    estimatedUsd: prev?.estimatedUsd,
  })
  const memory = getMemoryLayer()
  if (memory && rec && (rec.status === "complete" || rec.status === "error" || rec.status === "cancelled")) {
    void rememberCompletedRun(runtime, memory, runId)
  }
}

export function usageFields(rec: { usage?: { inputTokens: number; outputTokens: number; calls: number } } | undefined, disk?: { inputTokens?: number; outputTokens?: number; calls?: number; estimatedUsd?: number }) {
  const usage = rec?.usage
  return {
    inputTokens: usage?.inputTokens ?? disk?.inputTokens,
    outputTokens: usage?.outputTokens ?? disk?.outputTokens,
    calls: usage?.calls ?? disk?.calls,
    estimatedUsd: disk?.estimatedUsd,
  }
}
