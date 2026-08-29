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

const ANTHROPIC_VERSION = "2023-06-01"
const ANTHROPIC_BETA =
  "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14"

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      return anthropicMessages(config, messages, {})
    },
  }
}

export async function anthropicMessages(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  return (await anthropicMessagesDetailed(config, messages, opts)).text
}

export async function anthropicMessagesDetailed(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<ChatTurn> {
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
    max_tokens: resolveMaxTokens(config, 16384),
    messages: apiMessages,
  }
  if (systemParts.length > 0) {
    body.system = systemParts.join("\n\n")
  }

  const { status, text } = await providerFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": ANTHROPIC_BETA,
      ...(opts.headers ?? {}),
    },
    body: JSON.stringify(body),
    providerId: config.id,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: opts.signal,
  })

  assertOk(status, text, config.id)
  const data = parseJson(text, config.id)
  const content = extractAnthropicText(data)
  if (content === null) {
    throw new ProviderError("Anthropic response missing text content", {
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

function extractAnthropicText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const content = (data as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== "object") continue
    const type = (block as { type?: string }).type
    if (type === "text" && typeof (block as { text?: unknown }).text === "string") {
      parts.push((block as { text: string }).text)
    }
    if (type === "thinking" && typeof (block as { thinking?: unknown }).thinking === "string") {
      parts.push((block as { thinking: string }).thinking)
    }
  }
  if (parts.length === 0) return null
  return parts.join("")
}
