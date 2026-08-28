import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { rememberServerConfig } from "./client.js"
import { defaultMcpServers } from "./defaults.js"
import { badConfig } from "./errors.js"
import type { McpConfigFile, McpServerConfig } from "./types.js"

export function parseMcpConfig(raw: unknown): McpConfigFile {
  if (!raw || typeof raw !== "object") throw badConfig("config must be an object")
  const rec = raw as { mcpServers?: unknown }
  if (!rec.mcpServers || typeof rec.mcpServers !== "object") {
    throw badConfig("mcpServers object required")
  }
  const mcpServers: Record<string, McpServerConfig> = {}
  for (const [id, value] of Object.entries(rec.mcpServers as Record<string, unknown>)) {
    mcpServers[id] = normalizeServer(id, value)
  }
  return { mcpServers }
}

function normalizeServer(id: string, value: unknown): McpServerConfig {
  if (!value || typeof value !== "object") throw badConfig(`server ${id} is not an object`)
  const rec = value as Record<string, unknown>
  if (typeof rec.command === "string") {
    return {
      transport: "stdio",
      command: rec.command,
      args: Array.isArray(rec.args) ? rec.args.map(String) : [],
      env: isStringMap(rec.env) ? rec.env : undefined,
      cwd: typeof rec.cwd === "string" ? rec.cwd : undefined,
      timeoutMs: typeof rec.timeoutMs === "number" ? rec.timeoutMs : undefined,
    }
  }
  if (typeof rec.url === "string") {
    return {
      transport: "url",
      url: rec.url,
      headers: isStringMap(rec.headers) ? rec.headers : undefined,
      timeoutMs: typeof rec.timeoutMs === "number" ? rec.timeoutMs : undefined,
    }
  }
  if (rec.transport === "stdio" || rec.transport === "url") {
    return rec as unknown as McpServerConfig
  }
  throw badConfig(`server ${id} needs command or url`)
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") return false
  return Object.values(value).every((item) => typeof item === "string")
}

export async function loadMcpConfigFile(path: string): Promise<McpConfigFile> {
  const text = await readFile(path, "utf8")
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw badConfig(`invalid json: ${path}`)
  }
  return parseMcpConfig(parsed)
}

export async function loadMcpServersFromConfig(path?: string, workspace = "."): Promise<McpConfigFile> {
  const file = path
    ? await loadMcpConfigFile(resolve(path))
    : { mcpServers: defaultMcpServers(workspace) }
  for (const [id, config] of Object.entries(file.mcpServers)) {
    rememberServerConfig(id, config)
  }
  return file
}
