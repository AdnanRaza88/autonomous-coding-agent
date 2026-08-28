import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError, mapHttpError } from "./errors.js"

const DEFAULT_TIMEOUT_MS = 120_000
const ANTHROPIC_VERSION = "2023-06-01"

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      const base = config.baseUrl.replace(/\/$/, "")
      const url = `${base}/v1/messages`
      const systemParts: string[] = []
      const apiMessages: { role: "user" | "assistant"; content: string }[] = []

      for (const m of messages) {
        if (m.role === "system") {
          systemParts.push(m.content)
          continue
        }
        if (m.role === "user" || m.role === "assistant") {
          apiMessages.push({ role: m.role, content: m.content })
        }
      }

      if (apiMessages.length === 0) {
        throw new ProviderError("Anthropic requires at least one non-system message", {
          code: "invalid_request",
          providerId: config.id,
          retryable: false,
        })
      }

      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: Math.min(8192, Math.max(256, Math.floor(config.contextWindow / 4) || 4096)),
        messages: apiMessages,
      }
      if (systemParts.length > 0) {
        body.system = systemParts.join("\n\n")
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
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
          throw new ProviderError("Anthropic returned non-JSON body", {
            code: "unknown",
            providerId: config.id,
            cause,
          })
        }

        const content = extractAnthropicText(data)
        if (content === null) {
          throw new ProviderError("Anthropic response missing text content", {
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

function extractAnthropicText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const content = (data as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
      const t = (block as { text?: unknown }).text
      if (typeof t === "string") parts.push(t)
    }
  }
  if (parts.length === 0) return null
  return parts.join("")
}
