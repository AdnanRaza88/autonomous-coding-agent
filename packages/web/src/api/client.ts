import { maskSecrets } from "./secrets.js"
import type {
  AgentCoreApi,
  McpServerDraft,
  PermissionChoice,
  PermissionPrompt,
  ProviderModel,
  ProviderSummary,
  RunSnapshot,
  RunSummary,
  SaveProviderRequest,
  SavedProvider,
  SlashCommandInfo,
  StartRunRequest,
  StartRunResponse,
  SubagentDraft,
} from "./contract.js"

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = "HttpError"
  }
}

export function createHttpApi(baseUrl = ""): AgentCoreApi {
  const root = baseUrl.replace(/\/$/, "")

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
    const res = await fetch(`${root}${path}`, { ...init, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new HttpError(res.status, text || `${res.status} ${res.statusText}`)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  return {
    listProviders: () => request<ProviderSummary[]>("/api/providers"),
    listProviderModels: (providerId) =>
      request<ProviderModel[]>(`/api/providers/${encodeURIComponent(providerId)}/models`),
    listSavedProviders: () => request<SavedProvider[]>("/api/providers/saved"),
    saveProvider: (body: SaveProviderRequest) =>
      request<SavedProvider>("/api/providers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    startRun: (body: StartRunRequest) =>
      request<StartRunResponse>("/api/runs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getRun: (runId) => request<RunSnapshot>(`/api/runs/${encodeURIComponent(runId)}`),
    listRuns: async () => {
      const body = await request<{ runs: RunSummary[] }>("/api/runs")
      return body.runs
    },
    cancelRun: (runId) =>
      request<{ runId: string; cancelled: boolean; status?: string }>(
        `/api/runs/${encodeURIComponent(runId)}/cancel`,
        { method: "POST" },
      ),
    listSubagents: () => request<SubagentDraft[]>("/api/subagents"),
    upsertSubagent: (body) =>
      request<SubagentDraft>("/api/subagents", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteSubagent: (id) =>
      request<void>(`/api/subagents/${encodeURIComponent(id)}`, { method: "DELETE" }),
    listCommands: () => request<SlashCommandInfo[]>("/api/commands"),
    runCommand: (name, args) =>
      request<{ output: string }>(`/api/commands/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({ args }),
      }),
    listMcpServers: () => request<McpServerDraft[]>("/api/mcp/servers"),
    connectMcpServer: (body) =>
      request<McpServerDraft>("/api/mcp/servers", {
        method: "POST",
        body: JSON.stringify(maskSecrets(body)),
      }),
    listPermissions: () => request<{ pending: PermissionPrompt[] }>("/api/permissions"),
    decidePermission: (id, decision: PermissionChoice) =>
      request<void>(`/api/permissions/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    clearPermissionSession: () => request<void>("/api/permissions/session", { method: "DELETE" }),
  }
}
