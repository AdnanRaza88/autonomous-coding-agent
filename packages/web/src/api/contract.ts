import type { AgentResult, AgentTask, OrchestratorEvent, ProviderConfig } from "@agent-core/types"

export interface ProviderSummary {
  id: string
  name: string
  defaultBaseUrl: string
}

export interface ProviderModel {
  id: string
  name: string
  contextWindow: number
}

export interface SavedProvider {
  id: string
  baseUrl: string
  model: string
  contextWindow: number
  hasKey: boolean
}

export interface SubagentDraft {
  id: string
  name: string
  systemPromptTemplate: string
  defaultModel: string
  maxContextTokens: number
  tools: string[]
}

export interface SlashCommandInfo {
  name: string
  description: string
  risk?: "low" | "medium" | "high"
}

export interface McpServerDraft {
  id: string
  transport: "stdio" | "url"
  command?: string
  args?: string[]
  url?: string
  connected?: boolean
}

export interface PermissionPrompt {
  id: string
  kind: "mcp_tool" | "slash_command" | "hook" | "plugin"
  action: string
  risk: "low" | "medium" | "high"
  serverId?: string
  toolName?: string
  command?: string
  detail?: string
}

export type PermissionChoice =
  | "allow"
  | "deny"
  | "allow_session"
  | "allow_always"
  | "allow_server"
  | "deny_session"

export interface StartRunRequest {
  goal: string
  providerId: string
  model: string
}

export interface StartRunResponse {
  runId: string
}

export interface RunSnapshot {
  runId: string
  status: "planning" | "running" | "complete" | "error" | "cancelled"
  goal?: string
  tasks: AgentTask[]
  results: AgentResult[]
  events: OrchestratorEvent[]
  error?: string
}

export interface RunSummary {
  id: string
  goal: string
  status: string
  createdAt: string
}

export interface SaveProviderRequest {
  id: string
  baseUrl: string
  apiKey: string
  model: string
  contextWindow: number
}

export type WsInbound =
  | { channel: "orchestrator"; runId: string; event: OrchestratorEvent }
  | { channel: "permission"; prompt: PermissionPrompt }

export interface AgentCoreApi {
  listProviders(): Promise<ProviderSummary[]>
  listProviderModels(providerId: string): Promise<ProviderModel[]>
  listSavedProviders(): Promise<SavedProvider[]>
  saveProvider(body: SaveProviderRequest): Promise<SavedProvider>
  startRun(body: StartRunRequest): Promise<StartRunResponse>
  getRun(runId: string): Promise<RunSnapshot>
  listRuns(): Promise<RunSummary[]>
  cancelRun(runId: string): Promise<{ runId: string; cancelled: boolean; status?: string }>
  listSubagents(): Promise<SubagentDraft[]>
  upsertSubagent(body: SubagentDraft): Promise<SubagentDraft>
  deleteSubagent(id: string): Promise<void>
  listCommands(): Promise<SlashCommandInfo[]>
  runCommand(name: string, args: string[]): Promise<{ output: string }>
  listMcpServers(): Promise<McpServerDraft[]>
  connectMcpServer(body: McpServerDraft): Promise<McpServerDraft>
  listPermissions(): Promise<{ pending: PermissionPrompt[] }>
  decidePermission(id: string, decision: PermissionChoice): Promise<void>
  clearPermissionSession(): Promise<void>
}

export function redactProvider(config: ProviderConfig): SavedProvider {
  return {
    id: config.id,
    baseUrl: config.baseUrl,
    model: config.model,
    contextWindow: config.contextWindow,
    hasKey: config.apiKey.length > 0,
  }
}
