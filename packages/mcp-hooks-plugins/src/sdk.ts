import { connectFailed } from "./errors.js"
import type { LiveMcpSession, McpServerConfig, McpTool } from "./types.js"

type SdkBundle = {
  Client: new (info: { name: string; version: string }, caps?: { capabilities?: Record<string, unknown> }) => SdkClient
  StdioClientTransport: new (opts: {
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
  }) => unknown
  HttpTransport: new (url: URL, opts?: { requestInit?: RequestInit }) => unknown
}

type SdkClient = {
  connect(transport: unknown): Promise<void>
  close(): Promise<void>
  listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>
  callTool(req: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>
}

let cached: SdkBundle | undefined

async function loadSdk(): Promise<SdkBundle> {
  if (cached) return cached
  try {
    const clientMod = await import("@modelcontextprotocol/sdk/client/index.js")
    const stdioMod = await import("@modelcontextprotocol/sdk/client/stdio.js")
    let HttpTransport: SdkBundle["HttpTransport"]
    try {
      const httpMod = await import("@modelcontextprotocol/sdk/client/streamableHttp.js")
      HttpTransport = httpMod.StreamableHTTPClientTransport
    } catch {
      const sseMod = await import("@modelcontextprotocol/sdk/client/sse.js")
      HttpTransport = sseMod.SSEClientTransport
    }
    cached = {
      Client: clientMod.Client,
      StdioClientTransport: stdioMod.StdioClientTransport,
      HttpTransport,
    }
    return cached
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw connectFailed("sdk", message)
  }
}

function textFromResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result
  const rec = result as { content?: unknown; structuredContent?: unknown; isError?: boolean }
  if (rec.structuredContent !== undefined) return rec.structuredContent
  if (Array.isArray(rec.content)) {
    const texts = rec.content
      .map((block) => {
        if (block && typeof block === "object" && "text" in block) return String((block as { text: unknown }).text)
        return JSON.stringify(block)
      })
      .filter(Boolean)
    return texts.length === 1 ? texts[0] : texts.join("\n")
  }
  return result
}

export async function openSdkSession(id: string, config: McpServerConfig): Promise<LiveMcpSession> {
  const sdk = await loadSdk()
  const client = new sdk.Client(
    { name: "agent-core", version: "0.1.0" },
    { capabilities: {} }
  )

  let transport: unknown
  if (config.transport === "stdio") {
    if (!config.command) throw connectFailed(id, "stdio config needs command")
    transport = new sdk.StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env,
      cwd: config.cwd,
    })
  } else if (config.transport === "url") {
    if (!config.url) throw connectFailed(id, "url config needs url")
    const headers = config.headers
    transport = new sdk.HttpTransport(
      new URL(config.url),
      headers ? { requestInit: { headers } } : undefined
    )
  } else {
    throw connectFailed(id, `unsupported transport ${(config as { transport: string }).transport}`)
  }

  try {
    await client.connect(transport)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw connectFailed(id, message)
  }

  return {
    id,
    config,
    async listTools() {
      const listed = await client.listTools()
      return (listed.tools ?? []).map((tool) => ({
        serverId: id,
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
      })) as McpTool[]
    },
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args })
      return textFromResult(result)
    },
    async close() {
      await client.close()
    },
  }
}
