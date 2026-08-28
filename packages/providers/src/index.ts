import type { ProviderAdapter, ProviderConfig } from "@agent-core/types"
import { createAnthropicAdapter } from "./anthropic.js"
import { createGoogleAdapter } from "./google.js"
import { createOpenAICompatibleAdapter } from "./openai-compat.js"
import {
  getRegistryProvider,
  isNonOpenAICompatible,
  listBuiltinProvidersSync,
  loadRegistry,
} from "./registry.js"
import { ProviderError } from "./errors.js"

export { ProviderError }

const openaiAdapter = createOpenAICompatibleAdapter()
const anthropicAdapter = createAnthropicAdapter()
const googleAdapter = createGoogleAdapter()

let warmed = false

function ensureWarm(): void {
  if (warmed) return
  warmed = true
  void loadRegistry().catch(() => {})
}

export function getAdapter(config: ProviderConfig): ProviderAdapter {
  ensureWarm()
  const meta = getRegistryProvider(config.id)
  const npm = meta?.npm
  if (
    config.id === "anthropic" ||
    (npm !== undefined && isNonOpenAICompatible(config.id, npm) && npm.includes("anthropic"))
  ) {
    return anthropicAdapter
  }
  if (
    config.id === "google" ||
    config.id === "google-vertex" ||
    (npm !== undefined && npm.includes("@ai-sdk/google"))
  ) {
    return googleAdapter
  }
  return openaiAdapter
}

export function listBuiltinProviders(): { id: string; name: string; defaultBaseUrl: string }[] {
  ensureWarm()
  return listBuiltinProvidersSync()
}
