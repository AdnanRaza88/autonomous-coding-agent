import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { AgentResult, AgentTask, ProviderConfig } from "@agent-core/types"
import { connectProvider, getProviderModels, listBuiltinProviders, ProviderError } from "@agent-core/providers"
import { cancelRun, createRun, getRecord, getRunEvents, listRuns } from "@agent-core/graph-engine"
import type { CreateRunOptions } from "@agent-core/graph-engine"
import {
  clearSessionGrants,
  connectMcpServer,
  filePermissionStore,
  getServerConfig,
  listConfiguredServers,
  listConnectedServers,
  listPermissionRules,
  listSlashCommands,
  loadPersistedRules,
  rememberServerConfig,
  removePermissionRule,
  revokeGrants,
  runSlashCommand,
  setPermissionHandler,
  setPermissionStore,
} from "@agent-core/mcp-hooks-plugins"
import type { PermissionDecision, PermissionRequest } from "@agent-core/mcp-hooks-plugins"
import { getSubagentDefinition, listSubagentDefinitions, registerSubagentDefinition } from "@agent-core/subagents"
import type { Runtime } from "./bootstrap.js"
import { persistRun, usageFields } from "./persist-run.js"
import { formatSse, parseEventCursor, SSE_HEADERS } from "./sse.js"

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

const DECISIONS: PermissionDecision[] = [
  "allow",
  "deny",
  "allow_session",
  "allow_always",
  "allow_server",
  "deny_session",
]

let seq = 0
const pending = new Map<string, Pending>()
const permissionWatchers = new Set<(prompt: Prompt) => void>()

export type ProbeOutcome = {
  ok: boolean
  latencyMs: number
  code?: string
  message?: string
}

export type ControlPlaneOptions = {
  runOptions?: CreateRunOptions
  probe?: (config: ProviderConfig) => Promise<ProbeOutcome>
}

export async function registerControlPlane(
  app: FastifyInstance,
  runtime: Runtime,
  options: ControlPlaneOptions = {},
): Promise<void> {
  setPermissionStore(filePermissionStore(runtime.layout.grantsPath))
  loadPersistedRules()
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

  app.post<{ Params: { id: string } }>("/api/providers/:id/probe", async (req, reply) => {
    const id = req.params.id.trim()
    const config = resolveProvider(runtime, id)
    if (!config) {
      reply.code(404)
      return { ok: false, latencyMs: 0, code: "unknown_provider", message: `unknown provider ${id}` }
    }
    if (!config.apiKey && requiresKey(id)) {
      return { ok: false, latencyMs: 0, code: "missing_key", message: "no stored key" }
    }
    const probe = options.probe ?? defaultProbe
    const result = await probe(config)
    runtime.audit.write({
      action: "provider.probe",
      allowed: result.ok,
      detail: `${id}:${result.code ?? (result.ok ? "ok" : "fail")}`,
    })
    return result
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
      if (!decision || !DECISIONS.includes(decision)) {
        reply.code(400)
        return { error: "decision must be allow, deny, allow_session, allow_always, allow_server, or deny_session" }
      }
      pending.delete(req.params.id)
      item.resolve(decision)
      reply.code(204)
      return undefined
    },
  )

  app.get("/api/permissions", async () => ({ pending: [...pending.values()].map((p) => p.prompt) }))

  app.get("/api/permissions/rules", async () => ({ rules: listPermissionRules() }))

  app.delete<{ Params: { id: string } }>("/api/permissions/rules/:id", async (req, reply) => {
    const ok = removePermissionRule(req.params.id)
    if (!ok) {
      reply.code(404)
      return { error: "unknown rule" }
    }
    reply.code(204)
    return undefined
  })

  app.delete("/api/permissions/session", async (_req, reply) => {
    clearSessionGrants()
    reply.code(204)
    return undefined
  })

  app.get("/api/permissions/events", async (req, reply) => {
    openSse(reply)
    for (const item of pending.values()) {
      reply.raw.write(formatSse("permission", { channel: "permission", prompt: item.prompt }))
    }
    const send = (prompt: Prompt) => {
      try {
        reply.raw.write(formatSse("permission", { channel: "permission", prompt }))
      } catch {
        permissionWatchers.delete(send)
      }
    }
    permissionWatchers.add(send)
    await waitUntilClosed(req, () => permissionWatchers.delete(send))
  })

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
      if (!config.apiKey && requiresKey(providerId)) {
        reply.code(400)
        return { error: `no stored key for ${providerId}` }
      }
      const runId = await createRun(goal, config, options.runOptions)
      persistRun(runtime, runId, goal)
      runtime.audit.write({ action: "run.start", allowed: true, detail: runId })
      return { runId }
    },
  )

  app.get("/api/runs", async () => {
    const live = new Map(listRuns().map((row) => [row.id, row]))
    const stored = runtime.store.listRuns()
    const ids = new Set([...stored.map((r) => r.id), ...live.keys()])
    const runs = [...ids].map((id) => {
      const disk = runtime.store.getRun(id)
      const mem = live.get(id)
      const rec = getRecord(id)
      return {
        id,
        goal: disk?.goal ?? mem?.goal ?? rec?.spec?.goal ?? "",
        status: rec?.status ?? mem?.status ?? disk?.status ?? "unknown",
        createdAt: disk?.createdAt ?? (mem ? new Date(mem.createdAt).toISOString() : new Date().toISOString()),
        ...usageFields(rec ?? mem, disk),
      }
    })
    runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return { runs }
  })

  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req, reply) => {
    const rec = getRecord(req.params.id)
    if (!rec) {
      reply.code(404)
      return { error: `unknown run ${req.params.id}` }
    }
    persistRun(runtime, rec.id)
    const stored = runtime.store.getRun(req.params.id)
    return {
      runId: rec.id,
      status: rec.status,
      goal: stored?.goal ?? rec.spec?.goal,
      tasks: rec.tasks.map(cloneTask),
      results: rec.results.map(cloneResult),
      events: rec.events.slice(),
      error: rec.error,
      ...usageFields(rec, stored),
    }
  })

  app.post<{ Params: { id: string } }>("/api/runs/:id/cancel", async (req, reply) => {
    const rec = getRecord(req.params.id)
    if (!rec) {
      reply.code(404)
      return { error: `unknown run ${req.params.id}` }
    }
    const accepted = cancelRun(req.params.id)
    persistRun(runtime, req.params.id)
    runtime.audit.write({ action: "run.cancel", allowed: accepted, detail: req.params.id })
    return { runId: req.params.id, cancelled: accepted, status: getRecord(req.params.id)?.status }
  })

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/api/runs/:id/events", async (req, reply) => {
    const rec = getRecord(req.params.id)
    if (!rec) {
      reply.code(404)
      return { error: `unknown run ${req.params.id}` }
    }
    const headerId = Array.isArray(req.headers["last-event-id"])
      ? req.headers["last-event-id"][0]
      : req.headers["last-event-id"]
    const after = Math.max(parseEventCursor(req.query.after), parseEventCursor(headerId))
    openSse(reply)
    let index = after
    try {
      for await (const event of getRunEvents(req.params.id, after)) {
        if (req.raw.destroyed) break
        index += 1
        persistRun(runtime, req.params.id)
        reply.raw.write(
          formatSse(
            "orchestrator",
            {
              channel: "orchestrator",
              runId: req.params.id,
              event,
            },
            index,
          ),
        )
      }
    } catch (err) {
      reply.raw.write(
        formatSse("orchestrator", {
          channel: "orchestrator",
          runId: req.params.id,
          event: { type: "error", message: err instanceof Error ? err.message : String(err) },
        }),
      )
    } finally {
      persistRun(runtime, req.params.id)
      if (!reply.raw.writableEnded) reply.raw.end()
    }
  })
}

function openSse(reply: FastifyReply): void {
  reply.hijack()
  reply.raw.writeHead(200, SSE_HEADERS)
  reply.raw.write(": connected\n\n")
}

function waitUntilClosed(req: FastifyRequest, onClose: () => void): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      onClose()
      resolve()
    }
    if (req.raw.destroyed) {
      finish()
      return
    }
    req.raw.once("close", finish)
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
    for (const fn of permissionWatchers) fn(prompt)
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

function requiresKey(providerId: string): boolean {
  return providerId !== "ollama"
}

async function defaultProbe(config: ProviderConfig): Promise<ProbeOutcome> {
  const result = await connectProvider(config)
  if (result.ok) return { ok: true, latencyMs: result.latencyMs }
  const err = result.error
  return {
    ok: false,
    latencyMs: result.latencyMs,
    code: err instanceof ProviderError ? err.code : "unknown",
    message: err instanceof Error ? err.message : "probe failed",
  }
}

export function resetControlPlaneState(): void {
  pending.clear()
  permissionWatchers.clear()
  seq = 0
  setPermissionStore(undefined)
  revokeGrants()
  setPermissionHandler(undefined)
}
