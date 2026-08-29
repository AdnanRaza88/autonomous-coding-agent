import type { DeployProgress, DeployProgressListener } from "./types.js"

export type LoggedDeployProgress = DeployProgress & { id: number }

const listeners = new Set<DeployProgressListener>()
const log: LoggedDeployProgress[] = []
const MAX = 250
let seq = 0

export function onDeployProgress(listener: DeployProgressListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitProgress(event: DeployProgress): LoggedDeployProgress {
  seq += 1
  const logged: LoggedDeployProgress = { ...event, id: seq }
  log.push(logged)
  if (log.length > MAX) log.splice(0, log.length - MAX)
  for (const listener of listeners) {
    try {
      listener(logged)
    } catch {
      void 0
    }
  }
  return logged
}

export function listDeployProgress(runId?: string, after = -1): LoggedDeployProgress[] {
  return log.filter((row) => row.id > after && (!runId || row.runId === runId))
}

export function resetProgressListeners(): void {
  listeners.clear()
  log.length = 0
  seq = 0
}
