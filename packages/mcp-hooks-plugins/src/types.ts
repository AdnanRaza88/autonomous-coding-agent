import type { SharedSpec } from "@agent-core/types"

export type McpTransport = "stdio" | "url"

export interface McpServerConfig {
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface McpTool {
  serverId: string
  name: string
  description: string
  inputSchema?: Record<string, unknown>
}

export type PermissionKind = "mcp_tool" | "slash_command" | "hook" | "plugin"

export type PermissionRisk = "low" | "medium" | "high"

export interface PermissionRequest {
  kind: PermissionKind
  action: string
  risk: PermissionRisk
  serverId?: string
  toolName?: string
  command?: string
  hookName?: string
  detail?: string
  args?: Record<string, unknown>
}

export type PermissionDecision = "allow" | "deny" | "allow_session"

export type PermissionHandler = (
  request: PermissionRequest
) => Promise<boolean | PermissionDecision>

export type HookPoint =
  | "before-task"
  | "after-task"
  | "before-tool-call"
  | "after-tool-call"
  | "on-error"
  | "before-command"
  | "after-command"

export interface HookContext {
  point: HookPoint
  taskId?: string
  runId?: string
  serverId?: string
  toolName?: string
  command?: string
  hookName?: string
  error?: string
  args?: Record<string, unknown>
  result?: unknown
}

export type HookFn = (context: HookContext) => void | Promise<void>

export interface RunContext {
  cwd: string
  runId?: string
  taskId?: string
  spec?: SharedSpec
  emit?: (message: string) => void
  extras?: Record<string, unknown>
}

export interface SlashCommandDefinition {
  name: string
  description: string
  risk?: PermissionRisk
  handler: (args: string[], context: RunContext) => Promise<void>
}

export interface LiveMcpSession {
  id: string
  config: McpServerConfig
  listTools(): Promise<McpTool[]>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  close(): Promise<void>
}

export type McpConnector = (id: string, config: McpServerConfig) => Promise<LiveMcpSession>

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>
}
