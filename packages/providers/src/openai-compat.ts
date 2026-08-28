import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError, mapHttpError } from "./errors.js"

const DEFAULT_TIMEOUT_MS = 120_000

export function createOpenAICompatibleAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      const base = config.baseUrl.replace(/\/$/, "")
      const url = `${base}/chat/completions`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            stream: false,
          }),
          signal: controller.signal,
        })

        const text = await res.text()
        if (!res.ok) {
          throw mapHttpError(res.status, text, config.id)
        }

        let data: unknown
        try {
          data = JSON.parse(text)
        } catch (cause) {
          throw new ProviderError("Provider returned non-JSON body", {
            code: "unknown",
            providerId: config.id,
            cause,
          })
        }

        const content = extractOpenAIContent(data)
        if (content === null) {
          throw new ProviderError("Provider response missing assistant content", {
            code: "unknown",
            providerId: config.id,
          })
        }
        return content
      } catch (err) {
        if (err instanceof ProviderError) throw err
        if (err instanceof Error && err.name === "AbortError") {
          throw new ProviderError(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`, {
            code: "timeout",
            providerId: config.id,
            cause: err,
          })
        }
        throw new ProviderError(err instanceof Error ? err.message : "Network error", {
          code: "network",
          providerId: config.id,
          cause: err,
        })
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

function extractOpenAIContent(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!first || typeof first !== "object") return null
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== "object") return null
  const content = (message as { content?: unknown }).content
  if (typeof content === "string") return content
  return null
}
