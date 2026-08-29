import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { ProviderError, mapHttpError, toProviderError } from "./errors.js"
import {
  DEFAULT_TIMEOUT_MS,
  assertOk,
  parseJson,
  providerFetch,
  readSSELines,
  resolveMaxTokens,
  type ChatRequestOptions,
} from "./http.js"
import { estimateMessageUsage, parseUsage, type ChatTurn } from "./usage.js"

export function createOpenAICompatibleAdapter(): ProviderAdapter {
  return {
    async chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
      return chatCompletions(config, messages, {})
    },
  }
}

export async function chatCompletions(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  return (await chatCompletionsDetailed(config, messages, opts)).text
}

export async function chatCompletionsDetailed(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<ChatTurn> {
  const base = config.baseUrl.replace(/\/$/, "")
  const url = `${base}/chat/completions`
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  }
  if (config.apiKey && config.apiKey.length > 0) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  const { status, text } = await providerFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: resolveMaxTokens(config),
      stream: false,
    }),
    providerId: config.id,
    timeoutMs,
    signal: opts.signal,
  })

  assertOk(status, text, config.id)
  const data = parseJson(text, config.id)
  const content = extractOpenAIContent(data)
  if (content === null) {
    throw new ProviderError("Provider response missing assistant content", {
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

export async function* streamCompletions(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {}
): AsyncGenerator<string> {
  const base = config.baseUrl.replace(/\/$/, "")
  const url = `${base}/chat/completions`
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener("abort", onOuterAbort, { once: true })
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...(opts.headers ?? {}),
  }
  if (config.apiKey && config.apiKey.length > 0) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: resolveMaxTokens(config),
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw mapHttpError(res.status, text, config.id)
    }

    for await (const line of readSSELines(res, config.id, timeoutMs)) {
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") return
      let parsed: unknown
      try {
        parsed = JSON.parse(payload)
      } catch {
        continue
      }
      const piece = extractOpenAIDelta(parsed)
      if (piece) yield piece
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err
    throw toProviderError(err, config.id, timeoutMs)
  } finally {
    clearTimeout(timer)
    if (opts.signal) opts.signal.removeEventListener("abort", onOuterAbort)
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
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        parts.push((block as { text: string }).text)
      }
    }
    if (parts.length > 0) return parts.join("")
  }
  const toolCalls = (message as { tool_calls?: unknown }).tool_calls
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return JSON.stringify(toolCalls)
  }
  return null
}

function extractOpenAIDelta(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!first || typeof first !== "object") return null
  const delta = (first as { delta?: unknown }).delta
  if (!delta || typeof delta !== "object") return null
  const content = (delta as { content?: unknown }).content
  if (typeof content === "string") return content
  return null
}
