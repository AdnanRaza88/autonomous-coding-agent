# @agent-core/providers

Provider layer for Agent Core. One adapter shape for every LLM backend so the rest of the system never branches on vendor.

## Public API

```ts
import { getAdapter, listBuiltinProviders, ProviderError } from "@agent-core/providers"
import type { ProviderConfig, ChatMessage } from "@agent-core/types"

const providers = listBuiltinProviders()
// [{ id, name, defaultBaseUrl }, ...] — sourced from models.dev, cached locally

const adapter = getAdapter({
  id: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: userKey,
  model: "llama-3.3-70b-versatile",
  contextWindow: 128000,
})

const reply = await adapter.chat(config, [
  { role: "system", content: "You are a coding agent." },
  { role: "user", content: "List the files in src/" },
])
```

`ProviderConfig` is always supplied by the caller (settings UI / orchestrator). This package never reads API keys from the environment.

## How the catalog works

At first use the package fetches `https://models.dev/api.json` (the same registry OpenCode and Mastra use), stores it in SQLite under `~/.agent-core/cache/models-dev.sqlite`, and refreshes every 24 hours. If the network request fails, the previous cache is used. Override the cache directory with `AGENT_CORE_CACHE_DIR`.

Ollama is always present in the list even when models.dev omits it, defaulting to `http://127.0.0.1:11434/v1`.

## Adapter selection

| Provider shape | Implementation |
|---|---|
| OpenAI-compatible HTTP (`/chat/completions`) | Shared adapter (Groq, OpenAI, OpenRouter, Ollama, LM Studio, …) |
| Raw Anthropic Messages API | Thin translation in `anthropic.ts` |
| Raw Google Generative Language API | Thin translation in `google.ts` |

Selection is driven by the provider `id` and the `npm` field from models.dev. Everything else goes through the OpenAI-compatible path.

## Errors

Failures are thrown as `ProviderError` with:

- `code`: `timeout` | `rate_limit` | `auth` | `invalid_request` | `server` | `network` | `unknown`
- `status` (HTTP status when available)
- `providerId`
- `retryable` (true for timeout, rate limit, server, network)

Upstream modules (orchestrator / subagents) can branch on `code` and `retryable` without parsing strings.

## Standalone check

From the monorepo root:

```bash
npm install
node --experimental-strip-types -e '
  import { listBuiltinProviders, getAdapter } from "./packages/providers/src/index.ts"
  const list = listBuiltinProviders()
  console.log("providers", list.length)
  console.log(list.find(p => p.id === "groq") || list[0])
'
```

To exercise a live call, pass a real `ProviderConfig` with a valid key; the package does not ship credentials.

## Layout

```
packages/providers/
  src/
    index.ts           getAdapter, listBuiltinProviders, ProviderError
    registry.ts        models.dev fetch + SQLite cache
    openai-compat.ts   shared /chat/completions client
    anthropic.ts       Anthropic Messages client
    google.ts          Gemini generateContent client
    errors.ts          ProviderError + HTTP mapping
  package.json
  tsconfig.json
  README.md
```
