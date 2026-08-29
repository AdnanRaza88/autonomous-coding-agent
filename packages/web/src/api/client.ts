import { maskSecrets } from "./secrets.js"
import type {
  AgentCoreApi,
  DeployBindingView,
  DeployResultView,
  DeployTargetView,
  DetectedProjectView,
  GraphFactView,
  McpServerDraft,
  MemoryHealth,
  PermissionChoice,
  PermissionPrompt,
  PermissionRuleView,
  ProjectContextView,
  ProviderModel,
  ProviderProbe,
  ProviderSummary,
  RunSnapshot,
  RunSummary,
  SaveProviderRequest,
  SavedProvider,
  SlashCommandInfo,
  StartRunRequest,
  StartRunResponse,
  SubagentDraft,
  VaultGraphView,
  VaultNoteSummary,
  VaultNoteView,
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
    probeProvider: (id) =>
      request<ProviderProbe>(`/api/providers/${encodeURIComponent(id)}/probe`, { method: "POST" }),
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
    listPermissionRules: async () => {
      const body = await request<{ rules: PermissionRuleView[] }>("/api/permissions/rules")
      return body.rules
    },
    removePermissionRule: (id) =>
      request<void>(`/api/permissions/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
    clearPermissionSession: () => request<void>("/api/permissions/session", { method: "DELETE" }),
    memoryHealth: () => request<MemoryHealth>("/api/memory/health"),
    memoryContext: (query) =>
      request<ProjectContextView>(`/api/memory/context?q=${encodeURIComponent(query)}`),
    listFacts: async (query) => {
      const qs = query ? `?q=${encodeURIComponent(query)}` : ""
      const body = await request<{ facts: GraphFactView[] }>(`/api/memory/facts${qs}`)
      return body.facts
    },
    addFact: (body) =>
      request<GraphFactView>("/api/memory/facts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listVaultNotes: async () => {
      const body = await request<{ notes: VaultNoteSummary[] }>("/api/vault/notes")
      return body.notes
    },
    readVaultNote: (id) => request<VaultNoteView>(`/api/vault/notes/${encodeURIComponent(id)}`),
    writeVaultNote: (body) =>
      request<VaultNoteView>("/api/vault/notes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    vaultGraph: () => request<VaultGraphView>("/api/vault/graph"),
    vaultBacklinks: async (id) => {
      const body = await request<{ backlinks: { id: string; title: string }[] }>(
        `/api/vault/notes/${encodeURIComponent(id)}/backlinks`,
      )
      return body.backlinks
    },
    listDeployTargets: () => request<DeployTargetView[]>("/api/deploy/targets"),
    listDeployBindings: async () => {
      const body = await request<{ bindings: DeployBindingView[] }>("/api/deploy/bindings")
      return body.bindings
    },
    detectDeploy: (runId) =>
      request<DetectedProjectView>(`/api/deploy/detect?runId=${encodeURIComponent(runId)}`),
    saveDeployCredentials: (body) =>
      request<{ targetId: string; hasToken: boolean }>("/api/deploy/credentials", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deployRun: (body) =>
      request<DeployResultView>("/api/deploy", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  }
}
