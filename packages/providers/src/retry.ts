import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError } from "./errors.js"

export type RetryOptions = {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  signal?: AbortSignal
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProviderError("Retry aborted", { code: "timeout", providerId: "retry", retryable: false }))
      return
    }
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new ProviderError("Retry aborted", { code: "timeout", providerId: "retry", retryable: false }))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export async function chatWithRetry(
  adapter: ProviderAdapter,
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: RetryOptions = {}
): Promise<string> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3)
  const baseDelayMs = opts.baseDelayMs ?? 500
  const maxDelayMs = opts.maxDelayMs ?? 8_000
  let last: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await adapter.chat(config, messages)
    } catch (err) {
      last = err
      const pe = err instanceof ProviderError ? err : null
      const retryable = pe?.retryable === true
      if (!retryable || attempt >= maxAttempts) throw err
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
      const jitter = Math.floor(Math.random() * Math.min(250, delay / 4))
      await sleep(delay + jitter, opts.signal)
    }
  }
  throw last
}
