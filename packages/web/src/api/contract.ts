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

export interface PermissionRuleView {
  id: string
  effect: "allow" | "deny"
  scope: "exact" | "tool" | "server" | "kind"
  persist: "session" | "always"
  kind?: PermissionPrompt["kind"]
  serverId?: string
  toolName?: string
  command?: string
  action?: string
  expiresAt?: number
}

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
  inputTokens?: number
  outputTokens?: number
  calls?: number
}

export interface RunSummary {
  id: string
  goal: string
  status: string
  createdAt: string
  inputTokens?: number
  outputTokens?: number
  calls?: number
}

export interface SaveProviderRequest {
  id: string
  baseUrl: string
  apiKey: string
  model: string
  contextWindow: number
}

export interface ProviderProbe {
  ok: boolean
  latencyMs: number
  code?: string
  message?: string
}

export interface MemoryHealth {
  automem: "ok" | "down" | "skipped"
  graphiti: "ok" | "down" | "skipped"
}

export interface GraphFactView {
  id: string
  text: string
  source?: string
  kind: "fact" | "node" | "episode" | "edit"
  groupId?: string
  createdAt?: string
}

export interface ProjectContextView {
  relevantMemories: string[]
  relevantKnowledgeGraphFacts: string[]
}

export interface VaultNoteSummary {
  id: string
  title: string
  path: string
  kind?: string
  links: string[]
  mtimeMs?: number
}

export interface VaultNoteView extends VaultNoteSummary {
  body: string
  properties?: Record<string, string>
}

export interface VaultGraphView {
  nodes: { id: string; title: string; kind?: string; path?: string }[]
  edges: { from: string; to: string; label?: string }[]
}

export interface DeployTargetView {
  id: string
  kind: "static" | "container"
}

export interface DetectedProjectView {
  kind: "static" | "container"
  framework?: string
  reasons: string[]
}

export interface DeployBindingView {
  runId: string
  projectDir: string
  targetId?: string
  lastUrl?: string
}

export interface DeployResultView {
  runId?: string
  url: string
  status: "live" | "failed"
  targetId: string
  remoteId?: string
  message?: string
}

export type WsInbound =
  | { channel: "orchestrator"; runId: string; event: OrchestratorEvent }
  | { channel: "permission"; prompt: PermissionPrompt }

export interface AgentCoreApi {
  listProviders(): Promise<ProviderSummary[]>
  listProviderModels(providerId: string): Promise<ProviderModel[]>
  listSavedProviders(): Promise<SavedProvider[]>
  saveProvider(body: SaveProviderRequest): Promise<SavedProvider>
  probeProvider(id: string): Promise<ProviderProbe>
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
  listPermissionRules(): Promise<PermissionRuleView[]>
  removePermissionRule(id: string): Promise<void>
  clearPermissionSession(): Promise<void>
  memoryHealth(): Promise<MemoryHealth>
  memoryContext(query: string): Promise<ProjectContextView>
  listFacts(query?: string): Promise<GraphFactView[]>
  addFact(body: { statement: string; replaces?: string; note?: string }): Promise<GraphFactView>
  listVaultNotes(): Promise<VaultNoteSummary[]>
  readVaultNote(id: string): Promise<VaultNoteView>
  writeVaultNote(body: {
    id?: string
    title: string
    body: string
    links?: string[]
    properties?: Record<string, string>
  }): Promise<VaultNoteView>
  vaultGraph(): Promise<VaultGraphView>
  vaultBacklinks(id: string): Promise<{ id: string; title: string }[]>
  listDeployTargets(): Promise<DeployTargetView[]>
  listDeployBindings(): Promise<DeployBindingView[]>
  detectDeploy(runId: string): Promise<DetectedProjectView>
  saveDeployCredentials(body: {
    targetId: string
    token: string
    teamId?: string
    org?: string
    projectName?: string
    region?: string
  }): Promise<{ targetId: string; hasToken: boolean }>
  deployRun(body: {
    runId: string
    targetId?: string
    token?: string
    projectName?: string
  }): Promise<DeployResultView>
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
