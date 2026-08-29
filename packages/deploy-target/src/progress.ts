import type { DeployProgress, DeployProgressListener } from "./types.js"

const listeners = new Set<DeployProgressListener>()

export function onDeployProgress(listener: DeployProgressListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitProgress(event: DeployProgress): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      void 0
    }
  }
}

export function resetProgressListeners(): void {
  listeners.clear()
}
