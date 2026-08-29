import type { Runtime } from "./bootstrap.js"
import { getRecord } from "@agent-core/graph-engine"
import { estimateUsd, getProviderModels } from "@agent-core/providers"
import { getMemoryLayer } from "@agent-core/memory-knowledge"
import { rememberCompletedRun } from "./knowledge-plane.js"

export function persistRun(
  runtime: Runtime,
  runId: string,
  goalHint?: string,
  meta?: { providerId?: string; model?: string },
): void {
  const rec = getRecord(runId)
  const prev = runtime.store.getRun(runId)
  const providerId = meta?.providerId ?? prev?.providerId
  const model = meta?.model ?? prev?.model
  const inputTokens = rec?.usage.inputTokens ?? prev?.inputTokens
  const outputTokens = rec?.usage.outputTokens ?? prev?.outputTokens
  const calls = rec?.usage.calls ?? prev?.calls
  runtime.store.upsertRun({
    id: runId,
    goal: goalHint ?? prev?.goal ?? rec?.spec?.goal ?? "",
    status: rec?.status ?? prev?.status ?? "planning",
    createdAt: prev?.createdAt ?? new Date(rec?.createdAt ?? Date.now()).toISOString(),
    providerId,
    model,
    inputTokens,
    outputTokens,
    calls,
    estimatedUsd: priceRun(providerId, model, inputTokens, outputTokens) ?? prev?.estimatedUsd,
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

function priceRun(
  providerId: string | undefined,
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | undefined {
  if (!providerId || !model) return undefined
  const listed = getProviderModels(providerId).find((row) => row.id === model)
  if (!listed?.cost) return undefined
  return estimateUsd(
    { inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0, calls: 1 },
    listed.cost,
  )
}
