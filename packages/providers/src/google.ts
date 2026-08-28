import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError, mapHttpError } from "./errors.js"

const DEFAULT_TIMEOUT_MS = 120_000

export function createGoogleAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      const base = config.baseUrl.replace(/\/$/, "")
      const modelPath = config.model.includes("/") ? config.model.split("/").pop()! : config.model
      const url = `${base}/v1beta/models/${encodeURIComponent(modelPath)}:generateContent?key=${encodeURIComponent(config.apiKey)}`

      const systemParts: string[] = []
      const contents: { role: string; parts: { text: string }[] }[] = []

      for (const m of messages) {
        if (m.role === "system") {
          systemParts.push(m.content)
          continue
        }
        const role = m.role === "assistant" ? "model" : "user"
        contents.push({ role, parts: [{ text: m.content }] })
      }

      if (contents.length === 0) {
        throw new ProviderError("Google requires at least one non-system message", {
          code: "invalid_request",
          providerId: config.id,
          retryable: false,
        })
      }

      const body: Record<string, unknown> = { contents }
      if (systemParts.length > 0) {
        body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          throw new ProviderError("Google returned non-JSON body", {
            code: "unknown",
            providerId: config.id,
            cause,
          })
        }

        const content = extractGoogleText(data)
        if (content === null) {
          throw new ProviderError("Google response missing text content", {
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

function extractGoogleText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const first = candidates[0]
  if (!first || typeof first !== "object") return null
  const content = (first as { content?: unknown }).content
  if (!content || typeof content !== "object") return null
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return null
  const texts: string[] = []
  for (const p of parts) {
    if (p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string") {
      texts.push((p as { text: string }).text)
    }
  }
  if (texts.length === 0) return null
  return texts.join("")
}
