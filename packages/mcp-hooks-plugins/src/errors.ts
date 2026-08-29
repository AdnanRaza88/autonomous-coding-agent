export class McpError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "McpError"
    this.code = code
  }
}

export function denied(action: string): McpError {
  return new McpError("permission_denied", `denied: ${action}`)
}

export function unknownServer(id: string): McpError {
  return new McpError("unknown_server", `mcp server not connected: ${id}`)
}

export function unknownTool(serverId: string, tool: string): McpError {
  return new McpError("unknown_tool", `tool ${tool} not on ${serverId}`)
}

export function unknownCommand(name: string): McpError {
  return new McpError("unknown_command", `slash command not found: ${name}`)
}

export function badConfig(reason: string): McpError {
  return new McpError("bad_config", reason)
}

export function connectFailed(id: string, reason: string): McpError {
  return new McpError("connect_failed", `connect ${id}: ${reason}`)
}
