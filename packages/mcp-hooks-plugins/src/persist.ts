import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { PermissionKind, PermissionRule, PermissionScope } from "./types.js"

export interface PermissionStore {
  load(): PermissionRule[]
  save(rules: PermissionRule[]): void
}

const KINDS: PermissionKind[] = ["mcp_tool", "slash_command", "hook", "plugin"]
const SCOPES: PermissionScope[] = ["exact", "tool", "server", "kind"]

export function filePermissionStore(path: string): PermissionStore {
  return {
    load() {
      if (!existsSync(path)) return []
      const raw = readFileSync(path, "utf8").trim()
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw) as { rules?: unknown }
        return Array.isArray(parsed.rules) ? parsed.rules.flatMap(asRule) : []
      } catch {
        return []
      }
    },
    save(rules) {
      mkdirSync(dirname(path), { recursive: true })
      const tmp = `${path}.tmp`
      writeFileSync(tmp, JSON.stringify({ version: 1, rules }, null, 2), { encoding: "utf8", mode: 0o600 })
      renameSync(tmp, path)
    },
  }
}

function asRule(value: unknown): PermissionRule[] {
  if (!value || typeof value !== "object") return []
  const rec = value as Record<string, unknown>
  if (typeof rec.id !== "string" || !rec.id) return []
  if (rec.effect !== "allow" && rec.effect !== "deny") return []
  if (typeof rec.scope !== "string" || !SCOPES.includes(rec.scope as PermissionScope)) return []
  const rule: PermissionRule = {
    id: rec.id,
    effect: rec.effect,
    scope: rec.scope as PermissionScope,
    persist: "always",
  }
  if (typeof rec.kind === "string" && KINDS.includes(rec.kind as PermissionKind)) rule.kind = rec.kind as PermissionKind
  if (typeof rec.serverId === "string") rule.serverId = rec.serverId
  if (typeof rec.toolName === "string") rule.toolName = rec.toolName
  if (typeof rec.command === "string") rule.command = rec.command
  if (typeof rec.action === "string") rule.action = rec.action
  return [rule]
}
