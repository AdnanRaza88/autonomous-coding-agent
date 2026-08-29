import { existsSync } from "node:fs"
import { join } from "node:path"
import Fastify, { type FastifyInstance } from "fastify"
import { bootstrapRuntime, type BootstrapOptions, type Runtime } from "./bootstrap.js"
import { registerControlPlane, type ControlPlaneOptions } from "./control-plane.js"
import { registerKnowledgePlane } from "./knowledge-plane.js"
import { DEFAULT_PORT } from "./paths.js"
import { VERSION } from "./version.js"
import { DeploySecurityError } from "./errors.js"

export type ServerOptions = BootstrapOptions & ControlPlaneOptions & {
  port?: number
  host?: string
  webRoot?: string
}

export type AppHandle = {
  app: FastifyInstance
  runtime: Runtime
  close: () => Promise<void>
}

export async function createApp(opts: ServerOptions = {}): Promise<AppHandle> {
  const runtime = bootstrapRuntime(opts)
  const app = Fastify({ logger: false })

  app.get("/health", async () => ({ ok: true, version: VERSION }))
  app.get("/version", async () => ({ version: VERSION }))
  app.get("/api/health", async () => ({
    ok: true,
    version: VERSION,
    dataDir: runtime.dataDir,
    workspace: runtime.layout.workspace,
  }))

  app.get("/api/secrets", async () => ({ secrets: runtime.store.listSecretIds() }))

  app.post<{ Body: { id?: string; kind?: "provider" | "mcp" | "other"; value?: string } }>(
    "/api/secrets",
    async (req, reply) => {
      const id = req.body?.id?.trim()
      const value = req.body?.value
      const kind = req.body?.kind ?? "other"
      if (!id || !value) {
        reply.code(400)
        return { error: "id and value are required" }
      }
      runtime.store.putSecret(id, kind, value)
      return { id, kind }
    },
  )

  app.get<{ Querystring: { limit?: string } }>("/api/audit", async (req) => {
    const limit = Number(req.query.limit ?? 100)
    return { events: runtime.audit.recent(Number.isFinite(limit) ? limit : 100) }
  })

  app.post<{ Body: { path?: string } }>("/api/sandbox/resolve", async (req, reply) => {
    const path = req.body?.path
    if (!path) {
      reply.code(400)
      return { error: "path is required" }
    }
    try {
      const resolved = runtime.sandbox.resolveInside(path)
      return { resolved }
    } catch (err) {
      return securityReply(reply, err)
    }
  })

  app.post<{ Body: { path?: string } }>("/api/sandbox/write-check", async (req, reply) => {
    const path = req.body?.path
    if (!path) {
      reply.code(400)
      return { error: "path is required" }
    }
    try {
      const resolved = runtime.sandbox.assertWritable(path)
      return { resolved }
    } catch (err) {
      return securityReply(reply, err)
    }
  })

  app.post<{ Body: { command?: string } }>("/api/sandbox/command", async (req, reply) => {
    const command = req.body?.command
    if (!command) {
      reply.code(400)
      return { error: "command is required" }
    }
    try {
      const parsed = runtime.sandbox.allowCommand(command)
      return { ok: true, bin: parsed.bin, argv: parsed.argv }
    } catch (err) {
      return securityReply(reply, err)
    }
  })

  await registerControlPlane(app, runtime, { runOptions: opts.runOptions })
  await registerKnowledgePlane(app, runtime)

  const webRoot = opts.webRoot ?? process.env.AGENT_CORE_WEB_ROOT
  if (webRoot && existsSync(webRoot)) {
    const staticPlugin = (await import("@fastify/static")).default
    await app.register(staticPlugin, {
      root: webRoot,
      prefix: "/",
      wildcard: false,
    })
    app.setNotFoundHandler(async (req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api")) {
        return reply.sendFile("index.html")
      }
      reply.code(404)
      return { error: "not found" }
    })
  } else {
    app.get("/", async () => ({
      name: "agent-core",
      version: VERSION,
      ui: "not bundled",
    }))
  }

  return {
    app,
    runtime,
    close: async () => {
      await app.close()
    },
  }
}

function securityReply(reply: { code: (n: number) => void }, err: unknown) {
  if (err instanceof DeploySecurityError) {
    reply.code(403)
    return { error: err.message, code: err.code, path: err.path, allowed: false }
  }
  reply.code(500)
  return { error: err instanceof Error ? err.message : "internal error" }
}

export async function startServer(opts: ServerOptions = {}): Promise<AppHandle> {
  const handle = await createApp(opts)
  const port = opts.port ?? Number(process.env.PORT ?? DEFAULT_PORT)
  const host = opts.host ?? process.env.HOST ?? "0.0.0.0"
  await handle.app.listen({ port, host })
  return handle
}

export function webDistGuess(): string | undefined {
  const candidates = [
    process.env.AGENT_CORE_WEB_ROOT,
    join(process.cwd(), "packages/web/dist"),
    join(process.cwd(), "web"),
    "/app/web",
  ]
  return candidates.find((p) => Boolean(p) && existsSync(join(p as string, "index.html")))
}
