import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { extname, join, normalize, relative, resolve, sep } from "node:path"
import type { Server } from "node:http"
import { IdeShellError } from "./errors.js"
import { DEFAULT_PROXY_PORT, LOOPBACK, loopbackOrigin, nextFreePort } from "./ports.js"
import { decodeWorkspaceKey, encodeWorkspaceKey } from "./workspace.js"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json",
}

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
])

export interface SpaProxyOptions {
  spaRoot: string
  backendOrigin: string
  port?: number
  workspace?: string
}

export interface SpaProxyHandle {
  origin: string
  port: number
  iframeUrl: (workspace?: string) => string
  close: () => Promise<void>
}

export async function startSpaProxy(opts: SpaProxyOptions): Promise<SpaProxyHandle> {
  const root = resolve(opts.spaRoot)
  if (!existsSync(join(root, "index.html"))) {
    throw new IdeShellError("spa_missing", `index.html not found under ${root}`)
  }
  const preferred = opts.port ?? DEFAULT_PROXY_PORT
  const bindPort = preferred === 0 ? 0 : await nextFreePort(preferred, LOOPBACK, 24)
  const backend = opts.backendOrigin.replace(/\/$/, "")
  const defaultWs = opts.workspace ? encodeWorkspaceKey(opts.workspace) : ""

  const server: Server = createServer((req, res) => {
    void handle(req, res, { root, backend, defaultWs })
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(bindPort, LOOPBACK, () => resolveListen())
  })
  const addr = server.address()
  const port = typeof addr === "object" && addr ? addr.port : bindPort

  return {
    origin: loopbackOrigin(port),
    port,
    iframeUrl: (workspace) => {
      const key = workspace ? encodeWorkspaceKey(workspace) : defaultWs
      if (!key) throw new IdeShellError("workspace_required", "workspace path required for iframe url")
      return `${loopbackOrigin(port)}/${key}/`
    },
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((err) => (err ? rejectClose(err) : resolveClose()))
      }),
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { root: string; backend: string; defaultWs: string },
): Promise<void> {
  const raw = req.url ?? "/"
  const parsed = new URL(raw, "http://127.0.0.1")
  const { rest, workspace } = stripWorkspace(parsed.pathname, ctx.defaultWs)

  applyFrameHeaders(res)

  if (rest.startsWith("/api") || rest.startsWith("/ws") || rest.startsWith("/health")) {
    await proxy(req, res, ctx.backend, rest + parsed.search)
    return
  }

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405
    res.end()
    return
  }

  const file = safeFile(ctx.root, rest)
  if (file) {
    streamFile(res, file, req.method === "HEAD")
    return
  }

  const index = join(ctx.root, "index.html")
  res.statusCode = 200
  res.setHeader("content-type", MIME[".html"])
  res.setHeader("cache-control", "no-store")
  if (workspace) res.setHeader("x-agent-workspace", decodeWorkspaceKey(workspace))
  if (req.method === "HEAD") {
    res.end()
    return
  }
  createReadStream(index).pipe(res)
}

function stripWorkspace(pathname: string, fallback: string): { rest: string; workspace: string } {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return { rest: "/", workspace: fallback }
  try {
    decodeWorkspaceKey(parts[0])
    const rest = "/" + parts.slice(1).join("/")
    return { rest: rest === "/" ? "/" : rest, workspace: parts[0] }
  } catch {
    return { rest: pathname.startsWith("/") ? pathname : `/${pathname}`, workspace: fallback }
  }
}

function safeFile(root: string, urlPath: string): string | null {
  if (urlPath === "/" || urlPath === "") return existsSync(join(root, "index.html")) ? join(root, "index.html") : null
  const cleaned = decodeURIComponent(urlPath.split("?")[0] ?? "")
  const target = resolve(root, "." + normalize(cleaned).replace(/^(\.\.[/\\])+/, ""))
  const rel = relative(root, target)
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) return null
  if (!existsSync(target)) return null
  const st = statSync(target)
  if (!st.isFile()) return null
  return target
}

function streamFile(res: ServerResponse, file: string, head: boolean): void {
  const ext = extname(file)
  res.statusCode = 200
  res.setHeader("content-type", MIME[ext] ?? "application/octet-stream")
  if (head) {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}

function applyFrameHeaders(res: ServerResponse): void {
  res.setHeader(
    "content-security-policy",
    "frame-ancestors 'self' vscode-file: vscode-webview: http://127.0.0.1:* http://localhost:*",
  )
  res.removeHeader("x-frame-options")
}

async function proxy(req: IncomingMessage, res: ServerResponse, backend: string, pathAndQuery: string): Promise<void> {
  const target = new URL(pathAndQuery, backend + "/")
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v || HOP.has(k.toLowerCase())) continue
    headers[k] = Array.isArray(v) ? v.join(", ") : v
  }
  headers.host = target.host
  const method = req.method ?? "GET"
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req)
  try {
    const upstream = await fetch(target, { method, headers, body })
    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      if (key === "x-frame-options" || key === "content-security-policy") return
      res.setHeader(key, value)
    })
    applyFrameHeaders(res)
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.end(buf)
  } catch (err) {
    res.statusCode = 502
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "proxy failed" }))
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on("end", () => resolveBody(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}
