import type { ChatMessage, TokenUsage } from "@agent-core/types"

export type ChatTurn = {
  text: string
  usage: TokenUsage
  estimated: boolean
}

export function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, calls: 0 }
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    calls: a.calls + b.calls,
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateMessageUsage(messages: ChatMessage[], reply: string): TokenUsage {
  let input = 0
  for (const m of messages) input += estimateTokens(m.content)
  return {
    inputTokens: input,
    outputTokens: estimateTokens(reply),
    calls: 1,
  }
}

export function parseUsage(data: unknown): TokenUsage | undefined {
  if (!data || typeof data !== "object") return undefined
  const rec = data as Record<string, unknown>
  const open = parseOpenAIUsage(rec.usage)
  if (open) return open
  const anth = parseAnthropicUsage(rec.usage)
  if (anth) return anth
  const goog = parseGoogleUsage(rec.usageMetadata)
  if (goog) return goog
  return undefined
}

function parseOpenAIUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rec = raw as Record<string, unknown>
  const input = num(rec.prompt_tokens) ?? num(rec.input_tokens)
  const output = num(rec.completion_tokens) ?? num(rec.output_tokens)
  if (input === undefined && output === undefined) return undefined
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    calls: 1,
  }
}

function parseAnthropicUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rec = raw as Record<string, unknown>
  const input = num(rec.input_tokens)
  const output = num(rec.output_tokens)
  if (input === undefined && output === undefined) return undefined
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    calls: 1,
  }
}

function parseGoogleUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rec = raw as Record<string, unknown>
  const input = num(rec.promptTokenCount)
  const output = num(rec.candidatesTokenCount)
  if (input === undefined && output === undefined) return undefined
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    calls: 1,
  }
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  return undefined
}

export function estimateUsd(
  usage: TokenUsage,
  cost?: { input?: number; output?: number },
): number | undefined {
  if (!cost) return undefined
  const inRate = cost.input ?? 0
  const outRate = cost.output ?? 0
  if (inRate <= 0 && outRate <= 0) return undefined
  const usd = (usage.inputTokens / 1_000_000) * inRate + (usage.outputTokens / 1_000_000) * outRate
  return Number(usd.toFixed(6))
}
