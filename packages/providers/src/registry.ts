import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import type Database from "better-sqlite3"

const MODELS_DEV_URL = "https://models.dev/api.json"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FALLBACK_DEFAULTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  xai: "https://api.x.ai/v1",
  togetherai: "https://api.together.xyz/v1",
  deepinfra: "https://api.deepinfra.com/v1/openai",
  mistral: "https://api.mistral.ai/v1",
  cohere: "https://api.cohere.ai/compatibility/v1",
  perplexity: "https://api.perplexity.ai",
  lmstudio: "http://127.0.0.1:1234/v1",
  ollama: "http://127.0.0.1:11434/v1",
  "azure-cognitive-services": "https://YOUR_RESOURCE.openai.azure.com",
  fireworks: "https://api.fireworks.ai/inference/v1",
  cerebras: "https://api.cerebras.ai/v1",
  deepseek: "https://api.deepseek.com",
}

export interface RegistryProvider {
  id: string
  name: string
  defaultBaseUrl: string
  env: string[]
  npm: string
  models: Record<
    string,
    {
      id: string
      name: string
      contextWindow: number
      cost?: { input?: number; output?: number }
    }
  >
}

interface CacheRow {
  payload: string
  fetched_at: number
}

let db: Database.Database | null = null
let memoryFallback: { payload: string; fetchedAt: number } | null = null
let inFlight: Promise<RegistryProvider[]> | null = null

function resolveCachePath(): string {
  const override = process.env.AGENT_CORE_CACHE_DIR
  const root = override && override.length > 0 ? override : join(homedir(), ".agent-core", "cache")
  mkdirSync(root, { recursive: true })
  return join(root, "models-dev.sqlite")
}

function openDb(): Database.Database {
  if (db) return db
  const require = createRequire(import.meta.url)
  const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3")
  const path = resolveCachePath()
  db = new BetterSqlite3(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS models_dev_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `)
  return db
}

function readCache(): CacheRow | null {
  try {
    const row = openDb().prepare("SELECT payload, fetched_at FROM models_dev_cache WHERE id = 1").get() as
      | CacheRow
      | undefined
    return row ?? null
  } catch {
    return memoryFallback
      ? { payload: memoryFallback.payload, fetched_at: memoryFallback.fetchedAt }
      : null
  }
}

function writeCache(payload: string, fetchedAt: number): void {
  try {
    openDb()
      .prepare(
        `INSERT INTO models_dev_cache (id, payload, fetched_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`
      )
      .run(payload, fetchedAt)
  } catch {
    memoryFallback = { payload, fetchedAt }
  }
}

function parseRegistry(raw: unknown): RegistryProvider[] {
  if (!raw || typeof raw !== "object") return []
  const out: RegistryProvider[] = []
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue
    const entry = value as Record<string, unknown>
    const name = typeof entry.name === "string" ? entry.name : id
    const env = Array.isArray(entry.env) ? entry.env.filter((e): e is string => typeof e === "string") : []
    const npm = typeof entry.npm === "string" ? entry.npm : "@ai-sdk/openai-compatible"
    const api = typeof entry.api === "string" ? entry.api : FALLBACK_DEFAULTS[id] ?? ""
    const modelsRaw = entry.models && typeof entry.models === "object" ? (entry.models as Record<string, unknown>) : {}
    const models: RegistryProvider["models"] = {}
    for (const [mid, mval] of Object.entries(modelsRaw)) {
      if (!mval || typeof mval !== "object") continue
      const m = mval as Record<string, unknown>
      const limit = m.limit && typeof m.limit === "object" ? (m.limit as Record<string, unknown>) : {}
      const contextWindow =
        typeof limit.context === "number" ? limit.context : typeof limit.context === "string" ? Number(limit.context) || 0 : 0
      const cost =
        m.cost && typeof m.cost === "object"
          ? {
              input: typeof (m.cost as { input?: unknown }).input === "number" ? (m.cost as { input: number }).input : undefined,
              output: typeof (m.cost as { output?: unknown }).output === "number" ? (m.cost as { output: number }).output : undefined,
            }
          : undefined
      models[mid] = {
        id: typeof m.id === "string" ? m.id : mid,
        name: typeof m.name === "string" ? m.name : mid,
        contextWindow,
        cost,
      }
    }
    out.push({
      id: typeof entry.id === "string" ? entry.id : id,
      name,
      defaultBaseUrl: api,
      env,
      npm,
      models,
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

async function fetchRemote(): Promise<string> {
  const res = await fetch(MODELS_DEV_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    throw new Error(`models.dev responded ${res.status}`)
  }
  return res.text()
}

function ensureLocalFallbacks(list: RegistryProvider[]): RegistryProvider[] {
  const byId = new Map(list.map((p) => [p.id, p]))
  if (!byId.has("ollama")) {
    byId.set("ollama", {
      id: "ollama",
      name: "Ollama",
      defaultBaseUrl: FALLBACK_DEFAULTS.ollama,
      env: [],
      npm: "@ai-sdk/openai-compatible",
      models: {},
    })
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadRegistry(forceRefresh = false): Promise<RegistryProvider[]> {
  if (inFlight && !forceRefresh) return inFlight

  const run = async (): Promise<RegistryProvider[]> => {
    const cached = readCache()
    const now = Date.now()
    const isFresh = cached && now - cached.fetched_at < CACHE_TTL_MS

    if (cached && (isFresh || !forceRefresh)) {
      try {
        const parsed = parseRegistry(JSON.parse(cached.payload))
        if (parsed.length > 0) {
          if (!isFresh) {
            void refreshInBackground()
          }
          return ensureLocalFallbacks(parsed)
        }
      } catch {
      }
    }

    try {
      const payload = await fetchRemote()
      writeCache(payload, now)
      return ensureLocalFallbacks(parseRegistry(JSON.parse(payload)))
    } catch (err) {
      if (cached) {
        try {
          return ensureLocalFallbacks(parseRegistry(JSON.parse(cached.payload)))
        } catch {
        }
      }
      throw err
    }
  }

  inFlight = run().finally(() => {
    inFlight = null
  })
  return inFlight
}

function refreshInBackground(): void {
  void (async () => {
    try {
      const payload = await fetchRemote()
      writeCache(payload, Date.now())
    } catch {
    }
  })()
}

export function listBuiltinProvidersSync(): { id: string; name: string; defaultBaseUrl: string }[] {
  const cached = readCache()
  if (!cached) {
    return Object.entries(FALLBACK_DEFAULTS).map(([id, defaultBaseUrl]) => ({
      id,
      name: id,
      defaultBaseUrl,
    }))
  }
  try {
    return ensureLocalFallbacks(parseRegistry(JSON.parse(cached.payload))).map((p) => ({
      id: p.id,
      name: p.name,
      defaultBaseUrl: p.defaultBaseUrl,
    }))
  } catch {
    return Object.entries(FALLBACK_DEFAULTS).map(([id, defaultBaseUrl]) => ({
      id,
      name: id,
      defaultBaseUrl,
    }))
  }
}

export function getRegistryProvider(id: string): RegistryProvider | undefined {
  const cached = readCache()
  if (!cached) return undefined
  try {
    return ensureLocalFallbacks(parseRegistry(JSON.parse(cached.payload))).find((p) => p.id === id)
  } catch {
    return undefined
  }
}

export function isNonOpenAICompatible(id: string, npm?: string): boolean {
  if (id === "anthropic" || id === "google") return true
  if (npm === "@ai-sdk/anthropic" || npm === "@ai-sdk/google") return true
  if (npm?.includes("anthropic") && !npm.includes("openai")) return true
  if (npm === "@ai-sdk/google-vertex") return true
  return false
}

export function listProviderModels(
  providerId: string
): { id: string; name: string; contextWindow: number; cost?: { input?: number; output?: number } }[] {
  const provider = getRegistryProvider(providerId)
  if (!provider) return []
  return Object.values(provider.models).map((m) => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow,
    cost: m.cost,
  }))
}

export async function ensureRegistryReady(): Promise<void> {
  await loadRegistry(false)
}
