import type { AgentResult, AgentTask, OrchestratorEvent } from "@agent-core/types"

export type ServeState = "stopped" | "starting" | "healthy" | "unhealthy" | "recovering"

export interface ServeEndpoints {
  health: string
  origin: string
  port: number
}

export interface SpawnRequest {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  cwd: string
  port: number
}

export interface SpawnedProcess {
  pid: number
  kill: (signal?: NodeJS.Signals) => boolean
}

export type ProcessSpawner = (req: SpawnRequest) => SpawnedProcess

export type HealthProbe = (url: string, timeoutMs: number) => Promise<boolean>

export interface ServeManagerOptions {
  command?: string
  args?: string[]
  cwd?: string
  preferredPort?: number
  host?: string
  healthPath?: string
  probeIntervalMs?: number
  probeTimeoutMs?: number
  readyTimeoutMs?: number
  maxPortAttempts?: number
  env?: NodeJS.ProcessEnv
  spawn?: ProcessSpawner
  probe?: HealthProbe
}

export interface AgentServeHandle {
  state: ServeState
  endpoints: ServeEndpoints
  pid?: number
  stop: () => Promise<void>
}

export interface ProposedChange {
  id: string
  taskId: string
  workspacePath: string
  original: string
  proposed: string
  language?: string
}

export interface DiffOpenRequest {
  leftUri: string
  rightUri: string
  title: string
  change: ProposedChange
}

export type DiffDecision = "accept" | "reject"

export interface AppliedChange {
  id: string
  workspacePath: string
  contents: string
}

export type RunPhase = "idle" | "planning" | "running" | "verifying" | "done" | "error"

export interface StatusSnapshot {
  phase: RunPhase
  label: string
  running: number
  verifying: number
  passed: number
  failed: number
  total: number
}

export interface SlashPaletteCommand {
  id: string
  title: string
  slash: string
  description: string
  risk: "low" | "medium" | "high"
}

export interface ThemePair {
  id: string
  label: string
  uiTheme: "vs" | "vs-dark"
  path: string
}

export interface SidebarTarget {
  origin: string
  iframeUrl: string
  workspaceKey: string
}

export interface IdeHostOptions extends ServeManagerOptions {
  spaRoot?: string
  proxyPort?: number
  workspace?: string
}
