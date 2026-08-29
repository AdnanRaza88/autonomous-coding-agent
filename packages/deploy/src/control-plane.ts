import type { FastifyInstance } from "fastify"
import type { AgentResult, AgentTask, ProviderConfig } from "@agent-core/types"
import { getProviderModels, listBuiltinProviders } from "@agent-core/providers"
import { createRun, getRecord } from "@agent-core/graph-engine"
import type { CreateRunOptions } from "@agent-core/graph-engine"
import {
  getSubagentDefinition,
  listSubagentDefinitions,
  registerSubagentDefinition,
} from "@agent-core/subagents"
import {
  connectMcpServer,
  getServerConfig,
  listConfiguredServers,
  listConnectedServers,
  listSlashCommands,
  rememberServerConfig,
  runSlashCommand,
  setPermissionHandler,
} from "@agent-core/mcp-hooks-plugins"
import type { PermissionDecision, PermissionRequest } from "@agent-core/mcp-hooks-plugins"
import type { Runtime } from "./bootstrap.js"

type Draft = {
  id: string
  name: string
  systemPromptTemplate: string
  defaultModel: string
  maxContextTokens: number
  tools: string[]
}

type Prompt = {
  id: string
  kind: PermissionRequest["kind"]
  action: string
  risk: PermissionRequest["risk"]
  serverId?: string
  toolName?: string
  command?: string
  detail?: string
}

type Pending = {
  prompt: Prompt
  request: PermissionRequest
  resolve: (decision: PermissionDecision) => void
}

let seq = 0
const pending = new Map<string, Pending>()

export type ControlPlaneOptions = {
  runOptions?: CreateRunOptions
}

export async function registerControlPlane(
  app: FastifyInstance,
  runtime: Runtime,
  options: ControlPlaneOptions = {},
): Promise<void> {
  installPermissionBridge()

  app.get("/api/providers", async () => listBuiltinProviders())

  app.get<{ Params: { id: string } }>("/api/providers/:id/models", async (req) => {
    return getProviderModels(req.params.id).map((m) => ({
      id: m.id,
      name: m.name,
      contextWindow: m.contextWindow,
    }))
  })

  app.get("/api/providers/saved", async () =>
    runtime.store.listProviders().map((row) => ({
      id: row.id,
      baseUrl: row.baseUrl,
      model: row.model,
      contextWindow: row.contextWindow,
      hasKey: Boolean(runtime.store.getSecretPlain(row.secretId)),
    })),
  )

  app.post<{
    Body: { id?: string; baseUrl?: string; apiKey?: string; model?: string; contextWindow?: number }
  }>("/api/providers", async (req, reply) => {
    const id = req.body?.id?.trim()
    const baseUrl = req.body?.baseUrl?.trim()
    const model = req.body?.model?.trim()
    const contextWindow = Number(req.body?.contextWindow ?? 0)
    if (!id || !baseUrl || !model || !Number.isFinite(contextWindow) || contextWindow <= 0) {
      reply.code(400)
      return { error: "id, baseUrl, model, and contextWindow are required" }
    }
    const secretId = `provider:${id}`
    if (req.body?.apiKey) runtime.store.putSecret(secretId, "provider", req.body.apiKey)
    runtime.store.upsertProvider({ id, baseUrl, model, contextWindow, secretId })
    runtime.audit.write({ action: "provider.upsert", allowed: true, detail: id })
    return {
      id,
      baseUrl,
      model,
      contextWindow,
      hasKey: Boolean(runtime.store.getSecretPlain(secretId)),
    }
  })

  app.get("/api/subagents", async () => mergeSubagents(runtime))

  app.post<{ Body: Draft }>("/api/subagents", async (req, reply) => {
    const body = req.body
    if (!body?.id || !body.name || !body.systemPromptTemplate || !body.defaultModel) {
      reply.code(400)
      return { error: "id, name, systemPromptTemplate, and defaultModel are required" }
    }
    const tokens = Number(body.maxContextTokens ?? 0)
    if (!Number.isFinite(tokens) || tokens <= 0) {
      reply.code(400)
      return { error: "maxContextTokens must be a positive number" }
    }
    const draft: Draft = {
      id: body.id.trim(),
      name: body.name.trim(),
      systemPromptTemplate: body.systemPromptTemplate,
      defaultModel: body.defaultModel,
      maxContextTokens: tokens,
      tools: Array.isArray(body.tools) ? body.tools.map(String) : [],
    }
    registerSubagentDefinition(draft)
    runtime.store.upsertSubagent({
      id: draft.id,
      name: draft.name,
      definition: draft,
      updatedAt: new Date().toISOString(),
    })
    runtime.audit.write({ action: "subagent.upsert", allowed: true, detail: draft.id })
    return draft
  })

  app.delete<{ Params: { id: string } }>("/api/subagents/:id", async (req, reply) => {
    const removed = runtime.store.deleteSubagent(req.params.id)
    if (!removed && !getSubagentDefinition(req.params.id)) {
      reply.code(404)
      return { error: "unknown subagent" }
    }
    reply.code(204)
    return undefined
  })

  app.get("/api/commands", async () =>
    listSlashCommands().map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      risk: cmd.risk,
    })),
  )

  app.post<{ Params: { name: string }; Body: { args?: string[] } }>(
    "/api/commands/:name",
    async (req, reply) => {
      const chunks: string[] = []
      try {
        await runSlashCommand(req.params.name, req.body?.args ?? [], {
          cwd: runtime.layout.workspace,
          emit: (message) => chunks.push(message),
          extras: {},
        })
        return { output: chunks.join("\n") }
      } catch (err) {
        reply.code(400)
        return { error: err instanceof Error ? err.message : "command failed" }
      }
    },
  )

  app.get("/api/mcp/servers", async () => {
    const connected = new Set(listConnectedServers())
    return listConfiguredServers().map((id) => {
      const cfg = getServerConfig(id)
      return {
        id,
        transport: cfg?.transport ?? "stdio",
        command: cfg?.command,
        args: cfg?.args,
        url: cfg?.url,
        connected: connected.has(id),
      }
    })
  })

  app.post<{
    Body: {
      id?: string
      transport?: "stdio" | "url"
      command?: string
      args?: string[]
      url?: string
    }
  }>("/api/mcp/servers", async (req, reply) => {
    const id = req.body?.id?.trim()
    const transport = req.body?.transport ?? "stdio"
    if (!id) {
      reply.code(400)
      return { error: "id is required" }
    }
    const config = {
      transport,
      command: req.body?.command,
      args: req.body?.args,
      url: req.body?.url,
    }
    rememberServerConfig(id, config)
    let connected = false
    try {
      await connectMcpServer(id, config)
      connected = true
    } catch {
      connected = false
    }
    runtime.audit.write({ action: "mcp.connect", allowed: connected, detail: id })
    return { id, transport, command: config.command, args: config.args, url: config.url, connected }
  })

  app.post<{ Params: { id: string }; Body: { decision?: PermissionDecision } }>(
    "/api/permissions/:id",
    async (req, reply) => {
      const item = pending.get(req.params.id)
      const decision = req.body?.decision
      if (!item) {
        reply.code(404)
        return { error: "unknown permission" }
      }
      if (decision !== "allow" && decision !== "deny" && decision !== "allow_session") {
        reply.code(400)
        return { error: "decision must be allow, deny, or allow_session" }
      }
      pending.delete(req.params.id)
      item.resolve(decision)
      reply.code(204)
      return undefined
    },
  )

  app.get("/api/permissions", async () => ({ pending: [...pending.values()].map((p) => p.prompt) }))

  app.post<{ Body: { goal?: string; providerId?: string; model?: string } }>(
    "/api/runs",
    async (req, reply) => {
      const goal = req.body?.goal?.trim()
      const providerId = req.body?.providerId?.trim()
      if (!goal || !providerId) {
        reply.code(400)
        return { error: "goal and providerId are required" }
      }
      const config = resolveProvider(runtime, providerId, req.body?.model)
      if (!config) {
        reply.code(400)
        return { error: `unknown provider ${providerId}` }
      }
      const runId = await createRun(goal, config, options.runOptions)
      runtime.store.upsertRun({
        id: runId,
        goal,
        status: "planning",
        createdAt: new Date().toISOString(),
      })
      runtime.audit.write({ action: "run.start", allowed: true, detail: runId })
      return { runId }
    },
  )

  app.get("/api/runs", async () => ({ runs: runtime.store.listRuns() }))

  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req, reply) => {
    const rec = getRecord(req.params.id)
    if (!rec) {
      reply.code(404)
      return { error: `unknown run ${req.params.id}` }
    }
    return {
      runId: rec.id,
      status: rec.status,
      tasks: rec.tasks.map(cloneTask),
      results: rec.results.map(cloneResult),
      events: rec.events.slice(),
      error: rec.error,
    }
  })
}

function resolveProvider(runtime: Runtime, providerId: string, model?: string): ProviderConfig | undefined {
  const saved = runtime.store.getProvider(providerId)
  if (saved) {
    return {
      id: saved.id,
      baseUrl: saved.baseUrl,
      apiKey: runtime.store.getSecretPlain(saved.secretId) ?? "",
      model: model || saved.model,
      contextWindow: saved.contextWindow,
    }
  }
  const catalog = listBuiltinProviders().find((p) => p.id === providerId)
  if (!catalog) return undefined
  const secret =
    runtime.store.getSecretPlain(`provider:${providerId}`) ?? runtime.store.getSecretPlain(providerId) ?? ""
  return {
    id: catalog.id,
    baseUrl: catalog.defaultBaseUrl,
    apiKey: secret,
    model: model || "",
    contextWindow: 128000,
  }
}

function mergeSubagents(runtime: Runtime): Draft[] {
  const live = new Map<string, Draft>()
  for (const def of listSubagentDefinitions()) live.set(def.id, def)
  for (const row of runtime.store.listSubagents()) {
    const def = asDraft(row.definition)
    if (def) {
      live.set(def.id, def)
      if (!getSubagentDefinition(def.id)) registerSubagentDefinition(def)
    }
  }
  return [...live.values()]
}

function asDraft(value: unknown): Draft | undefined {
  if (!value || typeof value !== "object") return undefined
  const rec = value as Record<string, unknown>
  if (typeof rec.id !== "string" || typeof rec.name !== "string") return undefined
  if (typeof rec.systemPromptTemplate !== "string" || typeof rec.defaultModel !== "string") return undefined
  const tokens = Number(rec.maxContextTokens)
  if (!Number.isFinite(tokens) || tokens <= 0) return undefined
  return {
    id: rec.id,
    name: rec.name,
    systemPromptTemplate: rec.systemPromptTemplate,
    defaultModel: rec.defaultModel,
    maxContextTokens: tokens,
    tools: Array.isArray(rec.tools) ? rec.tools.map(String) : [],
  }
}

function installPermissionBridge(): void {
  setPermissionHandler(async (request) => {
    if (request.risk === "low") return "allow"
    const id = `perm_${++seq}`
    const prompt: Prompt = {
      id,
      kind: request.kind,
      action: request.action,
      risk: request.risk,
    }
    if (request.serverId) prompt.serverId = request.serverId
    if (request.toolName) prompt.toolName = request.toolName
    if (request.command) prompt.command = request.command
    if (request.detail) prompt.detail = request.detail
    return await new Promise<PermissionDecision>((resolve) => {
      pending.set(id, { prompt, request, resolve })
    })
  })
}

function cloneTask(task: AgentTask): AgentTask {
  const copy: AgentTask = {
    id: task.id,
    title: task.title,
    instructions: task.instructions,
    dependsOn: [...task.dependsOn],
    status: task.status,
  }
  if (task.assignedModel) copy.assignedModel = task.assignedModel
  return copy
}

function cloneResult(result: AgentResult): AgentResult {
  return {
    taskId: result.taskId,
    output: result.output,
    attempt: result.attempt,
    passed: result.passed,
  }
}

export function resetControlPlaneState(): void {
  pending.clear()
  seq = 0
}
