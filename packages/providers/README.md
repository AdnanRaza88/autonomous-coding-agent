# @agent-core/providers

Provider layer for Agent Core. One adapter face for every LLM backend so the rest of the system never branches on vendor.

## Public API

```ts
import {
  getAdapter,
  listBuiltinProviders,
  getProviderModels,
  connectProvider,
  chat,
  streamChat,
  chatReliable,
  waitForRegistry,
  refreshProviderRegistry,
  ProviderError,
} from "@agent-core/providers"
import type { ProviderConfig, ChatMessage } from "@agent-core/types"

await waitForRegistry()

const providers = listBuiltinProviders()
const models = getProviderModels("groq")

const config: ProviderConfig = {
  id: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: userKey,
  model: "llama-3.3-70b-versatile",
  contextWindow: 131072,
}

const probe = await connectProvider(config)
if (!probe.ok) throw probe.error

const adapter = getAdapter(config)
const reply = await adapter.chat(config, [
  { role: "system", content: "You are a coding agent." },
  { role: "user", content: "List files in src/" },
])

await chatReliable(config, [{ role: "user", content: "hi" }], { maxAttempts: 3 })

for await (const token of streamChat(config, [{ role: "user", content: "hi" }])) {
  process.stdout.write(token)
}
```

`ProviderConfig` is always supplied by the caller. This package never reads API keys from the environment.

## Capabilities

| Capability | Status |
|---|---|
| models.dev catalog (200+ providers) | SQLite cache, 24h TTL, stale fallback |
| OpenAI-compatible HTTP | Shared adapter + SSE streaming |
| Anthropic Messages API | Thin translator + beta headers |
| Google Gemini generateContent | Thin translator + block-reason handling |
| Typed errors | timeout, rate_limit, auth, invalid_request, server, network, context_overflow, quota, model_not_found |
| Connection probe | `connectProvider` validates key/baseUrl before agent runs |
| Retry | `chatReliable` exponential backoff on retryable codes |
| Model listing | `getProviderModels` id, name, contextWindow, cost |

## Errors

`ProviderError` fields: `code`, `status`, `providerId`, `retryable`, `responseBody`.

Upstream should branch on `code` and `retryable` without string matching.

## Catalog

Fetches `https://models.dev/api.json` on first use, stores under `~/.agent-core/cache/models-dev.sqlite` (override with `AGENT_CORE_CACHE_DIR`). Ollama is always present at `http://127.0.0.1:11434/v1`.

## Layout

```
packages/providers/src/
  index.ts           public API
  registry.ts        models.dev + SQLite
  http.ts            shared fetch, timeouts, SSE
  openai-compat.ts   chat + stream
  anthropic.ts       Messages API
  google.ts          Gemini API
  errors.ts          ProviderError + body parsing
  retry.ts           chatWithRetry
  probe.ts           connection probe
```
