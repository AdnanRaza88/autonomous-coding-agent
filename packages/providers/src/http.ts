import type { ProviderConfig } from "@agent-core/types"
import { ProviderError, mapHttpError, toProviderError } from "./errors.js"

export const DEFAULT_TIMEOUT_MS = 120_000
export const DEFAULT_CONNECT_TIMEOUT_MS = 15_000

export type ChatRequestOptions = {
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

export async function providerFetch(
  url: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    providerId: string
    timeoutMs?: number
    signal?: AbortSignal
  }
): Promise<{ status: number; text: string }> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onOuterAbort = () => controller.abort()
  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener("abort", onOuterAbort, { once: true })
  }

  try {
    const res = await fetch(url, {
      method: init.method ?? "POST",
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    })
    const text = await res.text()
    return { status: res.status, text }
  } catch (err) {
    throw toProviderError(err, init.providerId, timeoutMs)
  } finally {
    clearTimeout(timer)
    if (init.signal) init.signal.removeEventListener("abort", onOuterAbort)
  }
}

export function assertOk(status: number, text: string, providerId: string): void {
  if (!status || status < 200 || status >= 300) {
    throw mapHttpError(status, text, providerId)
  }
}

export function parseJson(text: string, providerId: string): unknown {
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new ProviderError("Provider returned non-JSON body", {
      code: "unknown",
      providerId,
      cause,
      responseBody: text.slice(0, 2000),
    })
  }
}

export function resolveMaxTokens(config: ProviderConfig, cap = 8192): number {
  const fromWindow = Math.floor(config.contextWindow / 4)
  if (!Number.isFinite(fromWindow) || fromWindow <= 0) return Math.min(cap, 4096)
  return Math.min(cap, Math.max(256, fromWindow))
}

export async function* readSSELines(
  res: Response,
  providerId: string,
  timeoutMs: number
): AsyncGenerator<string> {
  if (!res.body) {
    throw new ProviderError("Provider returned empty stream body", {
      code: "unknown",
      providerId,
    })
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const read = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            const err = new ProviderError(`Stream stalled after ${timeoutMs}ms`, {
              code: "timeout",
              providerId,
            })
            void reader.cancel(err)
            reject(err)
          }, timeoutMs)
        }),
      ])
      if (read.done) break
      buffer += decoder.decode(read.value, { stream: true })
      const parts = buffer.split("\n")
      buffer = parts.pop() ?? ""
      for (const line of parts) {
        const trimmed = line.trimEnd()
        if (trimmed.length > 0) yield trimmed
      }
    }
    if (buffer.trim().length > 0) yield buffer.trimEnd()
  } finally {
    reader.releaseLock()
  }
}
