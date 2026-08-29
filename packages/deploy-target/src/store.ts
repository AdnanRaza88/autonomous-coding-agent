import type { SharedSpec } from "@agent-core/types"
import type { RunDeployBinding } from "./types.js"

const runs = new Map<string, RunDeployBinding>()

export function registerRun(
  runId: string,
  input: { projectDir: string; spec: SharedSpec; targetId?: string },
): RunDeployBinding {
  const existing = runs.get(runId)
  const next: RunDeployBinding = {
    runId,
    projectDir: input.projectDir,
    spec: input.spec,
    targetId: input.targetId ?? existing?.targetId,
    remoteProjectId: existing?.remoteProjectId,
    lastUrl: existing?.lastUrl,
  }
  runs.set(runId, next)
  return next
}

export function getRunBinding(runId: string): RunDeployBinding | undefined {
  return runs.get(runId)
}

export function rememberRemote(
  runId: string,
  patch: { targetId: string; remoteProjectId?: string; lastUrl?: string },
): void {
  const current = runs.get(runId)
  if (!current) return
  runs.set(runId, { ...current, ...patch })
}

export function listRunBindings(): RunDeployBinding[] {
  return [...runs.values()]
}

export function resetRunBindings(): void {
  runs.clear()
}
