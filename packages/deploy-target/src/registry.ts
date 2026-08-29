import { DeployError } from "./errors.js"
import type { DeployTarget } from "./types.js"

const targets = new Map<string, DeployTarget>()

export function registerDeployTarget(target: DeployTarget): void {
  if (!target.id.trim()) {
    throw new DeployError({ message: "deploy target id is empty", code: "unknown_target" })
  }
  targets.set(target.id, target)
}

export function getDeployTarget(id: string): DeployTarget {
  const found = targets.get(id)
  if (!found) {
    throw new DeployError({ message: `unknown deploy target: ${id}`, code: "unknown_target" })
  }
  return found
}

export function listDeployTargets(): DeployTarget[] {
  return [...targets.values()]
}

export function resetDeployTargets(): void {
  targets.clear()
}

export function hasDeployTarget(id: string): boolean {
  return targets.has(id)
}
