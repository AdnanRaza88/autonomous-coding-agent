import { badConfig, connectFailed, unknownServer, unknownTool } from "./errors.js"
import { runHooks } from "./hooks.js"
import { requestPermission } from "./permission.js"
import { openSdkSession } from "./sdk.js"
import type { LiveMcpSession, McpConnector, McpServerConfig, McpTool } from "./types.js"

const sessions = new Map<string, LiveMcpSession>()
const configs = new Map<string, McpServerConfig>()
let connector: McpConnector = openSdkSession

export function setMcpConnector(next: McpConnector | undefined): void {
  connector = next ?? openSdkSession
}

export function rememberServerConfig(id: string, config: McpServerConfig): void {
  configs.set(id, config)
}

export function getServerConfig(id: string): McpServerConfig | undefined {
  return configs.get(id)
}

export function listConfiguredServers(): string[] {
  return [...configs.keys()].sort()
}

export function listConnectedServers(): string[] {
  return [...sessions.keys()].sort()
}

export async function connectMcpServer(id: string, config: McpServerConfig): Promise<void> {
  const trimmed = id.trim()
  if (!trimmed) throw badConfig("server id required")
  validateConfig(config)
  const existing = sessions.get(trimmed)
  if (existing) await existing.close().catch(() => undefined)
  try {
    const session = await connector(trimmed, config)
    sessions.set(trimmed, session)
    configs.set(trimmed, config)
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw connectFailed(trimmed, message)
  }
}

export async function disconnectMcpServer(id: string): Promise<void> {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  await session.close().catch(() => undefined)
}

export async function disconnectAll(): Promise<void> {
  const ids = [...sessions.keys()]
  for (const id of ids) await disconnectMcpServer(id)
}

export async function listMcpTools(serverId: string): Promise<McpTool[]> {
  const session = sessions.get(serverId)
  if (!session) throw unknownServer(serverId)
  return session.listTools()
}

export async function listAllMcpTools(): Promise<McpTool[]> {
  const out: McpTool[] = []
  for (const id of sessions.keys()) {
    const tools = await listMcpTools(id)
    out.push(...tools)
  }
  return out
}

export async function invokeMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const session = sessions.get(serverId)
  if (!session) throw unknownServer(serverId)

  const tools = await session.listTools()
  const found = tools.find((tool) => tool.name === toolName)
  if (!found) throw unknownTool(serverId, toolName)

  const risk = inferRisk(toolName, args)
  await requestPermission({
    kind: "mcp_tool",
    action: `mcp:${serverId}:${toolName}`,
    risk,
    serverId,
    toolName,
    args,
  })

  await runHooks("before-tool-call", {
    point: "before-tool-call",
    serverId,
    toolName,
    args,
  })

  try {
    const result = await session.callTool(toolName, args)
    await runHooks("after-tool-call", {
      point: "after-tool-call",
      serverId,
      toolName,
      args,
      result,
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await runHooks("on-error", {
      point: "on-error",
      serverId,
      toolName,
      error: message,
      args,
    })
    throw err
  }
}

function validateConfig(config: McpServerConfig): void {
  if (config.transport === "stdio" && !config.command) {
    throw badConfig("stdio transport requires command")
  }
  if (config.transport === "url" && !config.url) {
    throw badConfig("url transport requires url")
  }
  if (config.transport !== "stdio" && config.transport !== "url") {
    throw badConfig(`unknown transport ${String((config as { transport?: string }).transport)}`)
  }
}

function inferRisk(toolName: string, args: Record<string, unknown>): "low" | "medium" | "high" {
  const name = toolName.toLowerCase()
  const blob = `${name} ${JSON.stringify(args).toLowerCase()}`
  if (/(delete|rm|write|commit|push|deploy|drop|destroy|exec|shell)/.test(blob)) return "high"
  if (/(edit|update|move|mkdir|create|patch|apply)/.test(blob)) return "medium"
  return "low"
}
