import { installBuiltinTargets } from "./builtins.js"

installBuiltinTargets()

export type { SharedSpec } from "@agent-core/types"
export type {
  DeployTarget,
  DeployTargetConfig,
  DeployResult,
  DeployStatus,
  DeployProgress,
  DeployProgressListener,
  DetectedProject,
  ProjectKind,
  RunDeployBinding,
} from "./types.js"

export { registerDeployTarget, getDeployTarget, listDeployTargets, resetDeployTargets } from "./registry.js"
export { deployProject, pickDefaultTarget } from "./deploy.js"
export { registerRun, getRunBinding, rememberRemote, listRunBindings, resetRunBindings } from "./store.js"
export { onDeployProgress, emitProgress, resetProgressListeners } from "./progress.js"
export { setTargetCredentials, getTargetCredentials, clearTargetCredentials, mergeConfig } from "./config.js"
export { detectProjectKind } from "./detect.js"
export { createVercelTarget } from "./vercel.js"
export { createFlyTarget } from "./fly.js"
export { DeployError } from "./errors.js"
export { installBuiltinTargets } from "./builtins.js"
