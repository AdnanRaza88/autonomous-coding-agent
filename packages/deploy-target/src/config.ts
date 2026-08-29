import type { DeployTargetConfig } from "./types.js"

const tokens = new Map<string, DeployTargetConfig>()

export function setTargetCredentials(targetId: string, config: DeployTargetConfig): void {
  if (!config.token.trim()) {
    throw new Error("token is empty")
  }
  tokens.set(targetId, { ...config })
}

export function getTargetCredentials(targetId: string): DeployTargetConfig | undefined {
  const stored = tokens.get(targetId)
  return stored ? { ...stored } : undefined
}

export function clearTargetCredentials(targetId?: string): void {
  if (targetId) tokens.delete(targetId)
  else tokens.clear()
}

export function mergeConfig(targetId: string, override?: Partial<DeployTargetConfig>): DeployTargetConfig {
  const stored = tokens.get(targetId)
  const token = override?.token ?? stored?.token ?? ""
  return {
    token,
    teamId: override?.teamId ?? stored?.teamId,
    org: override?.org ?? stored?.org,
    projectName: override?.projectName ?? stored?.projectName,
    region: override?.region ?? stored?.region,
    env: { ...stored?.env, ...override?.env },
    image: override?.image ?? stored?.image,
    framework: override?.framework ?? stored?.framework,
    production: override?.production ?? stored?.production ?? true,
  }
}
