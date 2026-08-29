import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError } from "./errors.js"
import { DEFAULT_CONNECT_TIMEOUT_MS } from "./http.js"

export type ProbeResult =
  | { ok: true; latencyMs: number }
  | { ok: false; error: ProviderError; latencyMs: number }

const PROBE_MESSAGES: ChatMessage[] = [{ role: "user", content: "Reply with exactly: ok" }]

export async function probeProvider(
  adapter: ProviderAdapter,
  config: ProviderConfig,
  opts: { timeoutMs?: number } = {}
): Promise<ProbeResult> {
  const started = Date.now()
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    await Promise.race([
      adapter.chat(config, PROBE_MESSAGES),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () =>
            reject(
              new ProviderError(`Probe timed out after ${timeoutMs}ms`, {
                code: "timeout",
                providerId: config.id,
              })
            ),
          { once: true }
        )
      }),
    ])
    return { ok: true, latencyMs: Date.now() - started }
  } catch (err) {
    const error =
      err instanceof ProviderError
        ? err
        : new ProviderError(err instanceof Error ? err.message : "Probe failed", {
            code: "network",
            providerId: config.id,
            cause: err,
          })
    return { ok: false, error, latencyMs: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}
