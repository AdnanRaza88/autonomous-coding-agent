import { join } from "node:path"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { SharedSpec } from "@agent-core/types"
import { getRecord } from "@agent-core/graph-engine"
import {
  createMemoryLayer,
  resetMemoryLayer,
  setMemoryLayer,
  type MemoryLayer,
} from "@agent-core/memory-knowledge"
import {
  createVault,
  setActiveVault,
  type Vault,
  type VaultEntity,
} from "@agent-core/vault-knowledge-base"
import {
  DeployError,
  detectProjectKind,
  deployProject,
  listDeployProgress,
  listDeployTargets,
  listRunBindings,
  onDeployProgress,
  registerRun,
  resetProgressListeners,
  resetRunBindings,
  setTargetCredentials,
} from "@agent-core/deploy-target"
import type { Runtime } from "./bootstrap.js"
import { formatSse, parseEventCursor, SSE_HEADERS } from "./sse.js"

export type KnowledgePlane = {
  memory: MemoryLayer
  vault: Vault
}

export async function registerKnowledgePlane(
  app: FastifyInstance,
  runtime: Runtime,
): Promise<KnowledgePlane> {
  const memory = setMemoryLayer(
    createMemoryLayer({
      mode: process.env.AGENT_CORE_MEMORY_MODE === "http" ? "http" : "local",
    }),
  )
  const vaultRoot = join(runtime.dataDir, "vault")
  const vault = createVault({
    root: vaultRoot,
    sync: {
      async applyEdit(edit) {
        await memory.applyUserFactEdit({
          statement: edit.statement,
          replaces: edit.replaces,
          note: edit.note ?? edit.noteId,
        })
      },
    },
  })
  await vault.init()
  setActiveVault(vault)

  app.get("/api/memory/health", async () => memory.health())

  app.get<{ Querystring: { q?: string } }>("/api/memory/context", async (req, reply) => {
    const q = req.query.q?.trim()
    if (!q) {
      reply.code(400)
      return { error: "q is required" }
    }
    return memory.getProjectContext(q)
  })

  app.get<{ Querystring: { q?: string; limit?: string } }>("/api/memory/facts", async (req) => {
    const limit = Number(req.query.limit ?? 20)
    const facts = await memory.listGraphFacts(req.query.q ?? "", Number.isFinite(limit) ? limit : 20)
    return { facts }
  })

  app.post<{ Body: { statement?: string; replaces?: string; note?: string } }>(
    "/api/memory/facts",
    async (req, reply) => {
      const statement = req.body?.statement?.trim()
      if (!statement) {
        reply.code(400)
        return { error: "statement is required" }
      }
      const saved = await memory.applyUserFactEdit({
        statement,
        replaces: req.body?.replaces,
        note: req.body?.note,
      })
      runtime.audit.write({ action: "memory.fact", allowed: true, detail: saved.id })
      return saved
    },
  )

  app.get("/api/vault/notes", async () => {
    const notes = await vault.listNotes()
    return {
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        path: n.path,
        kind: n.kind,
        links: n.links,
        mtimeMs: n.mtimeMs,
      })),
    }
  })

  app.get<{ Params: { id: string } }>("/api/vault/notes/:id", async (req, reply) => {
    const note = await vault.readNote(decodeURIComponent(req.params.id))
    if (!note) {
      reply.code(404)
      return { error: "unknown note" }
    }
    return note
  })

  app.get<{ Params: { id: string } }>("/api/vault/notes/:id/backlinks", async (req) => {
    const links = await vault.getBacklinks(decodeURIComponent(req.params.id))
    return { backlinks: links }
  })

  app.post<{
    Body: { id?: string; title?: string; body?: string; links?: string[]; properties?: Record<string, string> }
  }>("/api/vault/notes", async (req, reply) => {
    const title = req.body?.title?.trim()
    const body = req.body?.body
    if (!title || typeof body !== "string") {
      reply.code(400)
      return { error: "title and body are required" }
    }
    const entity: VaultEntity = {
      id: (req.body?.id ?? title).trim(),
      title,
      body,
      links: Array.isArray(req.body?.links) ? req.body.links.map(String) : [],
      properties: req.body?.properties ?? {},
    }
    const note = await vault.writeVaultNote(entity)
    runtime.audit.write({ action: "vault.write", allowed: true, detail: note.id })
    return note
  })

  app.get("/api/vault/graph", async () => vault.getVaultGraph())

  app.get("/api/deploy/targets", async () =>
    listDeployTargets().map((t) => ({ id: t.id, kind: t.kind })),
  )

  app.get("/api/deploy/bindings", async () => ({
    bindings: listRunBindings().map((b) => ({
      runId: b.runId,
      projectDir: b.projectDir,
      targetId: b.targetId,
      lastUrl: b.lastUrl,
    })),
  }))

  app.get<{ Querystring: { runId?: string } }>("/api/deploy/detect", async (req, reply) => {
    const bound = bindFromRun(runtime, req.query.runId)
    if (!bound) {
      reply.code(400)
      return { error: "runId is required and must exist" }
    }
    return detectProjectKind(bound.spec, bound.projectDir)
  })

  app.post<{
    Body: {
      targetId?: string
      token?: string
      teamId?: string
      org?: string
      projectName?: string
      region?: string
    }
  }>("/api/deploy/credentials", async (req, reply) => {
    const targetId = req.body?.targetId?.trim()
    const token = req.body?.token?.trim()
    if (!targetId || !token) {
      reply.code(400)
      return { error: "targetId and token are required" }
    }
    setTargetCredentials(targetId, {
      token,
      teamId: req.body?.teamId,
      org: req.body?.org,
      projectName: req.body?.projectName,
      region: req.body?.region,
    })
    const secretId = `deploy:${targetId}`
    runtime.store.putSecret(secretId, "other", token)
    runtime.audit.write({ action: "deploy.credentials", allowed: true, detail: targetId })
    return { targetId, hasToken: true }
  })

  app.get<{ Querystring: { runId?: string; after?: string } }>("/api/deploy/events", async (req, reply) => {
    const runId = req.query.runId?.trim()
    const headerId = Array.isArray(req.headers["last-event-id"])
      ? req.headers["last-event-id"][0]
      : req.headers["last-event-id"]
    let after = Math.max(parseEventCursor(req.query.after), parseEventCursor(headerId))
    openSse(reply)
    for (const row of listDeployProgress(runId, after)) {
      after = row.id
      reply.raw.write(formatSse("deploy", { channel: "deploy", event: row }, row.id))
    }
    const send = (event: ReturnType<typeof listDeployProgress>[number]) => {
      if (runId && event.runId !== runId) return
      if (event.id <= after) return
      after = event.id
      try {
        reply.raw.write(formatSse("deploy", { channel: "deploy", event }, event.id))
      } catch {
        unsub()
      }
    }
    const unsub = onDeployProgress(send)
    await waitUntilClosed(req, unsub)
  })

  app.post<{
    Body: {
      runId?: string
      targetId?: string
      token?: string
      projectName?: string
    }
  }>("/api/deploy", async (req, reply) => {
    const runId = req.body?.runId?.trim()
    const bound = bindFromRun(runtime, runId)
    if (!bound || !runId) {
      reply.code(400)
      return { error: "runId is required and must exist" }
    }
    if (req.body?.token && req.body?.targetId) {
      setTargetCredentials(req.body.targetId, {
        token: req.body.token,
        projectName: req.body.projectName,
      })
    }
    try {
      const result = await deployProject(runId, req.body?.targetId, {
        token: req.body?.token,
        projectName: req.body?.projectName,
      })
      runtime.audit.write({ action: "deploy.start", allowed: true, detail: `${runId}:${result.status}` })
      return { runId, ...result }
    } catch (err) {
      const message = err instanceof Error ? err.message : "deploy failed"
      const code = err instanceof DeployError ? err.code : "build_error"
      reply.code(code === "unknown_run" || code === "unknown_target" ? 400 : 502)
      return { error: message, code }
    }
  })

  return { memory, vault }
}

export function bindRunWorkspace(runtime: Runtime, runId: string): void {
  bindFromRun(runtime, runId)
}

export async function rememberCompletedRun(runtime: Runtime, memory: MemoryLayer, runId: string): Promise<void> {
  const rec = getRecord(runId)
  if (!rec) return
  if (rec.status !== "complete" && rec.status !== "error" && rec.status !== "cancelled") return
  try {
    await memory.recordRunComplete({
      runId,
      goal: rec.spec?.goal,
      spec: rec.spec,
      results: rec.results,
      outcome: rec.status,
    })
  } catch {
    return
  }
}

function bindFromRun(runtime: Runtime, runId: string | undefined): { spec: SharedSpec; projectDir: string } | undefined {
  if (!runId) return undefined
  const rec = getRecord(runId)
  if (!rec?.spec) return undefined
  const binding = registerRun(runId, {
    projectDir: runtime.layout.workspace,
    spec: rec.spec,
  })
  return { spec: binding.spec, projectDir: binding.projectDir }
}

export function resetKnowledgePlane(): void {
  resetMemoryLayer()
  setActiveVault(undefined)
  resetRunBindings()
  resetProgressListeners()
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
