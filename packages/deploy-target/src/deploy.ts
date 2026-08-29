import type { SharedSpec } from "@agent-core/types"
import { mergeConfig } from "./config.js"
import { detectProjectKind } from "./detect.js"
import { DeployError } from "./errors.js"
import { emitProgress } from "./progress.js"
import { getDeployTarget, listDeployTargets } from "./registry.js"
import { getRunBinding, rememberRemote } from "./store.js"
import type { DeployResult, DeployTargetConfig, ProjectKind } from "./types.js"

export async function deployProject(
  runId: string,
  targetId?: string,
  config?: Partial<DeployTargetConfig>,
): Promise<{ url: string; status: string }> {
  const binding = getRunBinding(runId)
  if (!binding) {
    throw new DeployError({ message: `unknown run: ${runId}`, code: "unknown_run" })
  }
  const detected = detectProjectKind(binding.spec, binding.projectDir)
  const chosenId = targetId ?? binding.targetId ?? pickDefaultTarget(detected.kind, binding.spec)
  const target = getDeployTarget(chosenId)
  const merged = mergeConfig(chosenId, {
    ...config,
    projectName: config?.projectName ?? binding.remoteProjectId ?? slugRun(runId, binding.spec),
  })

  emitProgress({
    runId,
    targetId: chosenId,
    phase: "building",
    message: `Packaging ${binding.projectDir} for ${chosenId}`,
  })

  try {
    emitProgress({
      runId,
      targetId: chosenId,
      phase: "deploying",
      message: `Uploading to ${chosenId}`,
    })
    const result: DeployResult = await target.deploy(binding.projectDir, merged)
    rememberRemote(runId, {
      targetId: chosenId,
      remoteProjectId: merged.projectName,
      lastUrl: result.url,
    })
    emitProgress({
      runId,
      targetId: chosenId,
      phase: result.status === "live" ? "live" : "failed",
      message: result.message ?? (result.status === "live" ? "Live" : "Deploy failed"),
      url: result.url,
    })
    return { url: result.url, status: result.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emitProgress({
      runId,
      targetId: chosenId,
      phase: "failed",
      message,
    })
    if (err instanceof DeployError) throw err
    throw new DeployError({
      message,
      code: "build_error",
      targetId: chosenId,
      cause: err,
    })
  }
}

export function pickDefaultTarget(kind: ProjectKind, spec: SharedSpec): string {
  const preferred = spec.constraints.deploy ?? spec.constraints.host ?? spec.constraints.target
  if (preferred) {
    const id = preferred.toLowerCase().trim()
    const match = listDeployTargets().find((t) => t.id === id)
    if (match) return match.id
  }
  const candidates = listDeployTargets().filter((t) => t.kind === kind)
  const detected = candidates.find((t) => t.detect(spec))
  if (detected) return detected.id
  if (candidates[0]) return candidates[0].id
  const any = listDeployTargets()[0]
  if (!any) {
    throw new DeployError({ message: "no deploy targets registered", code: "unknown_target" })
  }
  return any.id
}

function slugRun(runId: string, spec: SharedSpec): string {
  const fromGoal = spec.goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
  const tail = runId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()
  return [fromGoal || "app", tail].filter(Boolean).join("-")
}
