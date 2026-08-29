import { createFlyTarget } from "./fly.js"
import { registerDeployTarget } from "./registry.js"
import { createVercelTarget } from "./vercel.js"

let installed = false

export function installBuiltinTargets(): void {
  if (installed) return
  registerDeployTarget(createVercelTarget())
  registerDeployTarget(createFlyTarget())
  installed = true
}

export function resetBuiltinInstall(): void {
  installed = false
}
