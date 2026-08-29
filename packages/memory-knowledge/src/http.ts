import { isRetryableStatus, MemoryServiceError } from "./errors.js"

export interface HttpOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  timeoutMs: number
  retries?: number
}

export async function requestJson(
  service: "automem" | "graphiti",
  url: string,
  opts: HttpOptions,
): Promise<unknown> {
  const retries = opts.retries ?? 2
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
    try {
      const headers: Record<string, string> = { Accept: "application/json", ...opts.headers }
      let body: string | undefined
      if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(opts.body)
      }
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      })
      const text = await res.text()
      const parsed = parseLoose(text)
      if (!res.ok) {
        if (attempt < retries && isRetryableStatus(res.status)) {
          await sleep(backoff(attempt))
          continue
        }
        throw new MemoryServiceError({
          message: `${service} ${opts.method ?? "GET"} ${url} failed (${res.status})`,
          code: "http_error",
          service,
          status: res.status,
        })
      }
      return parsed
    } catch (err) {
      lastError = err
      if (err instanceof MemoryServiceError) throw err
      const aborted = err instanceof Error && err.name === "AbortError"
      if (attempt < retries && (aborted || isNetwork(err))) {
        await sleep(backoff(attempt))
        continue
      }
      throw new MemoryServiceError({
        message: aborted ? `${service} request timed out` : `${service} request failed`,
        code: aborted ? "timeout" : "network",
        service,
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
  return Math.min(1_500, 200 * 2 ** attempt)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
