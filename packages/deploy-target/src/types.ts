import type { SharedSpec } from "@agent-core/types"

export type DeployStatus = "queued" | "building" | "deploying" | "live" | "failed"

export type ProjectKind = "static" | "container"

export interface DeployTargetConfig {
  token: string
  teamId?: string
  org?: string
  projectName?: string
  region?: string
  env?: Record<string, string>
  image?: string
  framework?: string
  production?: boolean
}

export interface DeployResult {
  url: string
  status: "live" | "failed"
  targetId: string
  remoteId?: string
  message?: string
}

export interface DeployTarget {
  id: string
  kind: ProjectKind
  detect(projectPlan: SharedSpec): boolean
  deploy(projectDir: string, config: DeployTargetConfig): Promise<DeployResult>
}

export interface DeployProgress {
  runId: string
  targetId: string
  phase: DeployStatus
  message: string
  url?: string
}

export type DeployProgressListener = (event: DeployProgress) => void

export interface RunDeployBinding {
  runId: string
  projectDir: string
  spec: SharedSpec
  targetId?: string
  remoteProjectId?: string
  lastUrl?: string
}

export interface DetectedProject {
  kind: ProjectKind
  framework?: string
  reasons: string[]
}

export interface PackedFile {
  path: string
  data: Buffer
  size: number
  sha1: string
}
