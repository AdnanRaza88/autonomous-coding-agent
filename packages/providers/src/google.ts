import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError } from "./errors.js"
import {
  DEFAULT_TIMEOUT_MS,
  assertOk,
  parseJson,
  providerFetch,
  resolveMaxTokens,
  type ChatRequestOptions,
} from "./http.js"
import { estimateMessageUsage, parseUsage, type ChatTurn } from "./usage.js"

export function createGoogleAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      return googleGenerate(config, messages, {})
    },
  }
}

export async function googleGenerate(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  return (await googleGenerateDetailed(config, messages, opts)).text
}

export async function googleGenerateDetailed(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<ChatTurn> {
  const base = config.baseUrl.replace(/\/$/, "")
  const modelPath = config.model.includes("/") ? config.model.split("/").pop()! : config.model
  const keyQ = config.apiKey ? `?key=${encodeURIComponent(config.apiKey)}` : ""
  const url = `${base}/v1beta/models/${encodeURIComponent(modelPath)}:generateContent${keyQ}`

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

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: resolveMaxTokens(config, 8192),
    },
  }
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  }
  if (config.apiKey && !keyQ) {
    headers["x-goog-api-key"] = config.apiKey
  }

  const { status, text } = await providerFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    providerId: config.id,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: opts.signal,
  })

  assertOk(status, text, config.id)
  const data = parseJson(text, config.id)
  const content = extractGoogleText(data, config.id)
  if (content === null) {
    throw new ProviderError("Google response missing text content", {
      code: "unknown",
      providerId: config.id,
      responseBody: text.slice(0, 2000),
    })
  }
  const parsed = parseUsage(data)
  return {
    text: content,
    usage: parsed ?? estimateMessageUsage(messages, content),
    estimated: !parsed,
  }
}

function extractGoogleText(data: unknown, providerId: string): string | null {
  if (!data || typeof data !== "object") return null
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const promptFeedback = (data as { promptFeedback?: { blockReason?: string } }).promptFeedback
    if (promptFeedback?.blockReason) {
      throw new ProviderError(`Google blocked the prompt: ${promptFeedback.blockReason}`, {
        code: "invalid_request",
        providerId,
        retryable: false,
      })
    }
    return null
  }
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
