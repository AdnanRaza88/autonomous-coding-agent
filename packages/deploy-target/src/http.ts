import { DeployError, isRetryableStatus, mapHostError } from "./errors.js"

export interface JsonRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
  rawBody?: Buffer | Uint8Array
  timeoutMs?: number
  retries?: number
  targetId: string
}

export async function requestJson(req: JsonRequest): Promise<unknown> {
  const retries = req.retries ?? 2
  const timeoutMs = req.timeoutMs ?? 30_000
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers: Record<string, string> = { Accept: "application/json", ...req.headers }
      let body: BodyInit | undefined
      if (req.rawBody !== undefined) {
        body = req.rawBody
      } else if (req.body !== undefined) {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
        body = JSON.stringify(req.body)
      }
      const res = await fetch(req.url, {
        method: req.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      })
      const text = await res.text()
      if (!res.ok) {
        if (attempt < retries && isRetryableStatus(res.status)) {
          await sleep(backoff(attempt))
          continue
        }
        throw mapHostError(res.status, text, req.targetId)
      }
      return parseLoose(text)
    } catch (err) {
      lastError = err
      if (err instanceof DeployError) throw err
      const aborted = err instanceof Error && err.name === "AbortError"
      if (attempt < retries && (aborted || isNetwork(err))) {
        await sleep(backoff(attempt))
        continue
      }
      throw new DeployError({
        message: aborted ? `${req.targetId} request timed out` : `${req.targetId} request failed`,
        code: aborted ? "timeout" : "network",
        targetId: req.targetId,
        cause: err,
      })
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function parseLoose(text: string): unknown {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function isNetwork(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && /fetch|ECONN|ENOTFOUND|ECONNREFUSED/i.test(err.message))
}

function backoff(attempt: number): number {
  return Math.min(2_000, 250 * 2 ** attempt)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
