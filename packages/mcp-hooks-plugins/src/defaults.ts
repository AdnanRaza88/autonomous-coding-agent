import type { McpConfigFile, McpServerConfig } from "./types.js"

export function defaultMcpServers(workspace = "."): Record<string, McpServerConfig> {
  return {
    filesystem: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", workspace],
    },
    git: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-git", workspace],
    },
    automem: {
      transport: "url",
      url: process.env.AUTOMEM_MCP_URL ?? "http://127.0.0.1:8000/mcp",
    },
    graphiti: {
      transport: "url",
      url: process.env.GRAPHITI_MCP_URL ?? "http://127.0.0.1:8001/mcp",
    },
  }
}

export function defaultMcpConfig(workspace = "."): McpConfigFile {
  return { mcpServers: defaultMcpServers(workspace) }
}
