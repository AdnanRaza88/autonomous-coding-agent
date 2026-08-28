import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { createAnthropicAdapter, anthropicMessages } from "./anthropic.js"
import { createGoogleAdapter, googleGenerate } from "./google.js"
import {
  createOpenAICompatibleAdapter,
  chatCompletions,
  streamCompletions,
} from "./openai-compat.js"
import {
  getRegistryProvider,
  isNonOpenAICompatible,
  listBuiltinProvidersSync,
  listProviderModels,
  loadRegistry,
  ensureRegistryReady,
} from "./registry.js"
import { ProviderError } from "./errors.js"
import { chatWithRetry } from "./retry.js"
import { probeProvider, type ProbeResult } from "./probe.js"
import type { ChatRequestOptions } from "./http.js"

export { ProviderError }
export type { ProviderErrorCode } from "./errors.js"
export type { ProbeResult }
export type { ChatRequestOptions }
export type { RegistryProvider } from "./registry.js"

const openaiAdapter = createOpenAICompatibleAdapter()
const anthropicAdapter = createAnthropicAdapter()
const googleAdapter = createGoogleAdapter()

let warmed = false

function ensureWarm(): void {
  if (warmed) return
  warmed = true
  void loadRegistry().catch(() => {})
}

function selectKind(config: ProviderConfig): "anthropic" | "google" | "openai" {
  const meta = getRegistryProvider(config.id)
  const npm = meta?.npm
  if (
    config.id === "anthropic" ||
    (npm !== undefined && isNonOpenAICompatible(config.id, npm) && npm.includes("anthropic"))
  ) {
    return "anthropic"
  }
  if (
    config.id === "google" ||
    config.id === "google-vertex" ||
    (npm !== undefined && npm.includes("@ai-sdk/google"))
  ) {
    return "google"
  }
  return "openai"
}

export function getAdapter(config: ProviderConfig): ProviderAdapter {
  ensureWarm()
  const kind = selectKind(config)
  if (kind === "anthropic") return anthropicAdapter
  if (kind === "google") return googleAdapter
  return openaiAdapter
}

export function listBuiltinProviders(): { id: string; name: string; defaultBaseUrl: string }[] {
  ensureWarm()
  return listBuiltinProvidersSync()
}

export function getProviderModels(
  providerId: string
): { id: string; name: string; contextWindow: number; cost?: { input?: number; output?: number } }[] {
  ensureWarm()
  return listProviderModels(providerId)
}

export async function refreshProviderRegistry(): Promise<void> {
  await loadRegistry(true)
}

export async function waitForRegistry(): Promise<void> {
  await ensureRegistryReady()
}

export async function connectProvider(
  config: ProviderConfig,
  opts?: { timeoutMs?: number }
): Promise<ProbeResult> {
  ensureWarm()
  const adapter = getAdapter(config)
  return probeProvider(adapter, config, opts)
}

export async function chat(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: ChatRequestOptions
): Promise<string> {
  ensureWarm()
  const kind = selectKind(config)
  if (kind === "anthropic") return anthropicMessages(config, messages, opts)
  if (kind === "google") return googleGenerate(config, messages, opts)
  return chatCompletions(config, messages, opts)
}

export async function* streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: ChatRequestOptions
): AsyncGenerator<string> {
  ensureWarm()
  const kind = selectKind(config)
  if (kind !== "openai") {
    const full = await chat(config, messages, opts)
    if (full.length > 0) yield full
    return
  }
  yield* streamCompletions(config, messages, opts)
}

export async function chatReliable(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; signal?: AbortSignal }
): Promise<string> {
  ensureWarm()
  return chatWithRetry(getAdapter(config), config, messages, opts)
}
