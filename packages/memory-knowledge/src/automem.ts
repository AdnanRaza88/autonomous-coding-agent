import type { AutoMemConfig } from "./config.js"
import { requestJson } from "./http.js"
import type { AutoMemClient, StoredMemory } from "./types.js"

export function createAutoMemClient(config: AutoMemConfig): AutoMemClient {
  const headers: Record<string, string> = {}
  if (config.token) headers.Authorization = `Bearer ${config.token}`

  return {
    async store(input) {
      const body = {
        content: input.content,
        type: input.type ?? "Decision",
        tags: input.tags ?? [],
        importance: clamp01(input.importance ?? 0.7),
        metadata: input.metadata ?? {},
      }
      const raw = await requestJson("automem", `${config.baseUrl}/memory`, {
        method: "POST",
        headers,
        body,
        timeoutMs: config.timeoutMs,
      })
      const rec = asRecord(raw)
      const id = str(rec.memory_id) || str(rec.id) || fallbackId("mem")
      return { id }
    },

    async recall(query, limit) {
      const url = new URL(`${config.baseUrl}/recall`)
      url.searchParams.set("query", query)
      url.searchParams.set("limit", String(Math.max(1, limit)))
      url.searchParams.set("state_mode", "current")
      url.searchParams.set("expand_relations", "true")
      url.searchParams.set("expand_min_importance", "0.35")
      const raw = await requestJson("automem", url.toString(), {
        headers,
        timeoutMs: config.timeoutMs,
      })
      return parseRecall(raw)
    },

    async health() {
      try {
        const raw = await requestJson("automem", `${config.baseUrl}/health`, {
          timeoutMs: Math.min(config.timeoutMs, 3_000),
          retries: 0,
        })
        const rec = asRecord(raw)
        const status = str(rec.status) || str(rec.ok)
        return status === "ok" || status === "success" || rec.ok === true || rec.status === true
      } catch {
        return false
      }
    },
  }
}

function parseRecall(raw: unknown): StoredMemory[] {
  const rec = asRecord(raw)
  const list = firstArray(rec.results, rec.memories, rec.data)
  const out: StoredMemory[] = []
  for (const item of list) {
    const row = asRecord(item)
    const nested = asRecord(row.memory)
    const content = str(row.content) || str(nested.content) || str(row.text)
    if (!content) continue
    out.push({
      id: str(row.memory_id) || str(row.id) || str(nested.id) || fallbackId("mem"),
      content,
      type: str(row.type) || str(nested.type) || undefined,
      tags: stringList(row.tags ?? nested.tags),
      importance: num(row.importance ?? nested.importance, 0.5),
      metadata: asRecord(row.metadata ?? nested.metadata),
      createdAt: str(row.timestamp) || str(row.created_at) || str(nested.created_at) || new Date().toISOString(),
    })
  }
  return out
}

function firstArray(...candidates: unknown[]): unknown[] {
  for (const c of candidates) {
    if (Array.isArray(c)) return c
  }
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function fallbackId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
