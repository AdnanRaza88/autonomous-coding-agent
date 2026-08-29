import type { GraphitiConfig } from "./config.js"
import { requestJson } from "./http.js"
import type { GraphFact, GraphitiClient } from "./types.js"

export function createGraphitiClient(config: GraphitiConfig): GraphitiClient {
  return {
    async addEpisode(input) {
      const body = {
        name: input.name,
        episode_body: input.body,
        source: input.source ?? "text",
        source_description: input.sourceDescription ?? "agent-core",
        group_id: input.groupId ?? config.groupId,
        reference_time: new Date().toISOString(),
      }
      const raw = await requestJson("graphiti", `${config.baseUrl}/episodes`, {
        method: "POST",
        body,
        timeoutMs: config.timeoutMs,
      })
      const rec = asRecord(raw)
      return { id: str(rec.episode_uuid) || str(rec.uuid) || str(rec.id) || fallbackId("ep") }
    },

    async searchFacts(query, limit) {
      const raw = await requestJson("graphiti", `${config.baseUrl}/search/facts`, {
        method: "POST",
        body: { query, group_id: config.groupId, num_results: limit },
        timeoutMs: config.timeoutMs,
      })
      return parseFacts(raw, config.groupId, "fact")
    },

    async searchNodes(query, limit) {
      const raw = await requestJson("graphiti", `${config.baseUrl}/search/nodes`, {
        method: "POST",
        body: { query, group_id: config.groupId, num_results: limit },
        timeoutMs: config.timeoutMs,
      })
      return parseFacts(raw, config.groupId, "node")
    },

    async listRecent(limit) {
      const url = new URL(`${config.baseUrl}/episodes`)
      url.searchParams.set("group_id", config.groupId)
      url.searchParams.set("limit", String(limit))
      const raw = await requestJson("graphiti", url.toString(), { timeoutMs: config.timeoutMs })
      return parseFacts(raw, config.groupId, "episode")
    },

    async health() {
      for (const path of ["/health", "/status", "/"]) {
        try {
          const raw = await requestJson("graphiti", `${config.baseUrl}${path}`, {
            timeoutMs: Math.min(config.timeoutMs, 3_000),
            retries: 0,
          })
          const rec = asRecord(raw)
          if (rec.status === "ok" || rec.ok === true || rec.success === true) return true
          if (path === "/") return true
        } catch {
          continue
        }
      }
      return false
    },
  }
}

function parseFacts(raw: unknown, groupId: string, kind: GraphFact["kind"]): GraphFact[] {
  const rec = asRecord(raw)
  const list = firstArray(rec.results, rec.facts, rec.episodes, rec.nodes, rec.data)
  const out: GraphFact[] = []
  for (const item of list) {
    const row = asRecord(item)
    const text =
      str(row.fact) ||
      str(row.summary) ||
      str(row.content) ||
      str(row.name) ||
      joinNameRel(row)
    if (!text) continue
    out.push({
      id: str(row.uuid) || str(row.id) || fallbackId("gf"),
      text,
      source: str(row.source_description) || str(row.source) || undefined,
      kind,
      groupId: str(row.group_id) || groupId,
      createdAt: str(row.created_at) || str(row.valid_at) || new Date().toISOString(),
    })
  }
  return out
}

function joinNameRel(row: Record<string, unknown>): string {
  const name = str(row.name)
  const relation = str(row.relation) || str(row.edge_name)
  const target = str(row.target) || str(row.other)
  if (name && relation && target) return `${name} ${relation} ${target}`
  return ""
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

function fallbackId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
