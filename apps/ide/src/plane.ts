import type { DeployProgressView } from "./types.js"

export type MemoryHealth = {
  automem: "ok" | "down" | "skipped"
  graphiti: "ok" | "down" | "skipped"
}

export type VaultGraphSnapshot = {
  nodes: { id: string; title: string; kind?: string; path?: string }[]
  edges: { from: string; to: string; label?: string }[]
}

export type DeployTargetInfo = { id: string; kind: "static" | "container" }

export type DetectedProjectInfo = {
  kind: "static" | "container"
  framework?: string
  reasons: string[]
}

export type DeployResultInfo = {
  runId?: string
  url: string
  status: "live" | "failed"
  targetId: string
  message?: string
}

export type PlaneHandle = {
  close(): void
}

function originRoot(origin: string): string {
  return origin.replace(/\/$/, "")
}

export function memoryHealthUrl(origin: string): string {
  return `${originRoot(origin)}/api/memory/health`
}

export function memoryContextUrl(origin: string, query: string): string {
  return `${originRoot(origin)}/api/memory/context?q=${encodeURIComponent(query)}`
}

export function vaultGraphUrl(origin: string): string {
  return `${originRoot(origin)}/api/vault/graph`
}

export function vaultNotesUrl(origin: string): string {
  return `${originRoot(origin)}/api/vault/notes`
}

export function deployTargetsUrl(origin: string): string {
  return `${originRoot(origin)}/api/deploy/targets`
}

export function deployDetectUrl(origin: string, runId: string): string {
  return `${originRoot(origin)}/api/deploy/detect?runId=${encodeURIComponent(runId)}`
}

export function deployUrl(origin: string): string {
  return `${originRoot(origin)}/api/deploy`
}

export function deployEventsUrl(origin: string, runId: string, after?: number): string {
  const base = `${originRoot(origin)}/api/deploy/events?runId=${encodeURIComponent(runId)}`
  if (after === undefined || after < 0) return base
  return `${base}&after=${after}`
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function fetchMemoryHealth(origin: string, fetchImpl: typeof fetch = fetch): Promise<MemoryHealth> {
  return json(await fetchImpl(memoryHealthUrl(origin)))
}

export async function fetchVaultGraph(origin: string, fetchImpl: typeof fetch = fetch): Promise<VaultGraphSnapshot> {
  return json(await fetchImpl(vaultGraphUrl(origin)))
}

export async function fetchVaultNotes(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string; title: string }[]> {
  const body = await json<{ notes: { id: string; title: string }[] }>(await fetchImpl(vaultNotesUrl(origin)))
  return body.notes
}

export async function fetchDeployTargets(origin: string, fetchImpl: typeof fetch = fetch): Promise<DeployTargetInfo[]> {
  return json(await fetchImpl(deployTargetsUrl(origin)))
}

export async function detectDeploy(
  origin: string,
  runId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DetectedProjectInfo> {
  return json(await fetchImpl(deployDetectUrl(origin, runId)))
}

export async function deployRun(
  origin: string,
  body: { runId: string; targetId?: string; token?: string; projectName?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<DeployResultInfo> {
  return json(
    await fetchImpl(deployUrl(origin), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

export function parseDeployFrames(
  chunk: string,
  onEvent: (event: DeployProgressView, id?: number) => boolean | void,
): void {
  for (const part of chunk.split("\n\n")) {
    if (!part.trim()) continue
    let eventName = "message"
    let id: string | undefined
    const dataLines: string[] = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim()
      else if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (eventName !== "deploy" && eventName !== "message") continue
    if (!dataLines.length) continue
    try {
      const parsed = JSON.parse(dataLines.join("\n")) as { channel?: string; event?: DeployProgressView }
      if (parsed.channel && parsed.channel !== "deploy") continue
      const ev = parsed.event ?? (parsed as unknown as DeployProgressView)
      if (!ev?.phase) continue
      const numeric = id !== undefined ? Number(id) : ev.id
      const stop = onEvent(ev, Number.isFinite(numeric) ? numeric : undefined)
      if (stop) return
    } catch {
      continue
    }
  }
}

export function watchIdeDeploy(opts: {
  origin: string
  runId: string
  onProgress: (event: DeployProgressView) => void
  fetchImpl?: typeof fetch
}): PlaneHandle {
  let closed = false
  const fetchImpl = opts.fetchImpl ?? fetch
  void (async () => {
    const res = await fetchImpl(deployEventsUrl(opts.origin, opts.runId))
    if (!res.ok || closed) return
    const text = await res.text()
    if (closed) return
    parseDeployFrames(text, (event) => {
      opts.onProgress(event)
      return event.phase === "live" || event.phase === "failed"
    })
  })().catch(() => undefined)
  return {
    close() {
      closed = true
    },
  }
}
