import { denied } from "./errors.js"
import type { PermissionStore } from "./persist.js"
import type {
  PermissionDecision,
  PermissionHandler,
  PermissionRequest,
  PermissionRule,
} from "./types.js"

const rules: PermissionRule[] = []
let handler: PermissionHandler | undefined
let store: PermissionStore | undefined
let seq = 0
let muteFlush = false

export function permissionKey(request: PermissionRequest): string {
  return [
    request.kind,
    request.action,
    request.serverId ?? "",
    request.toolName ?? "",
    request.command ?? "",
  ].join(":")
}

export function setPermissionHandler(next: PermissionHandler | undefined): void {
  handler = next
}

export function setPermissionStore(next: PermissionStore | undefined): void {
  store = next
}

export function loadPersistedRules(): PermissionRule[] {
  if (!store) return []
  muteFlush = true
  try {
    const loaded = store.load().filter((r) => r.persist === "always")
    const keep = rules.filter((r) => r.persist !== "always")
    rules.length = 0
    rules.push(...keep, ...loaded)
    for (const rule of loaded) bumpSeq(rule.id)
    return loaded.map((r) => ({ ...r }))
  } finally {
    muteFlush = false
  }
}

export function addPermissionRule(partial: Omit<PermissionRule, "id"> & { id?: string }): PermissionRule {
  const rule: PermissionRule = {
    id: partial.id ?? `rule_${++seq}`,
    effect: partial.effect,
    scope: partial.scope,
    persist: partial.persist,
  }
  if (partial.kind) rule.kind = partial.kind
  if (partial.serverId) rule.serverId = partial.serverId
  if (partial.toolName) rule.toolName = partial.toolName
  if (partial.command) rule.command = partial.command
  if (partial.action) rule.action = partial.action
  if (partial.expiresAt) rule.expiresAt = partial.expiresAt
  bumpSeq(rule.id)
  rules.push(rule)
  flush()
  return rule
}

export function grantAlways(request: PermissionRequest): PermissionRule {
  return addPermissionRule({
    effect: "allow",
    scope: "exact",
    persist: "always",
    kind: request.kind,
    serverId: request.serverId,
    toolName: request.toolName,
    command: request.command,
    action: request.action,
  })
}

export function grantSession(request: PermissionRequest, ttlMs?: number): PermissionRule {
  return addPermissionRule({
    effect: "allow",
    scope: "exact",
    persist: "session",
    kind: request.kind,
    serverId: request.serverId,
    toolName: request.toolName,
    command: request.command,
    action: request.action,
    expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
  })
}

export function grantServerSession(request: PermissionRequest, ttlMs?: number): PermissionRule {
  return addPermissionRule({
    effect: "allow",
    scope: "server",
    persist: "session",
    kind: request.kind,
    serverId: request.serverId,
    expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
  })
}

export function denySession(request: PermissionRequest, ttlMs?: number): PermissionRule {
  return addPermissionRule({
    effect: "deny",
    scope: "exact",
    persist: "session",
    kind: request.kind,
    serverId: request.serverId,
    toolName: request.toolName,
    command: request.command,
    action: request.action,
    expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
  })
}

export function listPermissionRules(): PermissionRule[] {
  prune()
  return rules.map((r) => ({ ...r }))
}

export function removePermissionRule(id: string): boolean {
  const idx = rules.findIndex((r) => r.id === id)
  if (idx < 0) return false
  rules.splice(idx, 1)
  flush()
  return true
}

export function revokeGrants(): void {
  rules.length = 0
  flush()
}

export function clearSessionGrants(): void {
  let changed = false
  for (let i = rules.length - 1; i >= 0; i--) {
    if (rules[i].persist === "session") {
      rules.splice(i, 1)
      changed = true
    }
  }
  if (changed) flush()
}

function prune(): void {
  const now = Date.now()
  let changed = false
  for (let i = rules.length - 1; i >= 0; i--) {
    const exp = rules[i].expiresAt
    if (exp && exp <= now) {
      rules.splice(i, 1)
      changed = true
    }
  }
  if (changed) flush()
}

function flush(): void {
  if (muteFlush || !store) return
  store.save(rules.filter((r) => r.persist === "always").map((r) => ({ ...r })))
}

function bumpSeq(id: string): void {
  const m = /^rule_(\d+)$/.exec(id)
  if (!m) return
  const n = Number(m[1])
  if (Number.isFinite(n) && n > seq) seq = n
}

export function matchRule(request: PermissionRequest): PermissionRule | undefined {
  prune()
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]
    if (matches(rule, request)) return rule
  }
  return undefined
}

function matches(rule: PermissionRule, request: PermissionRequest): boolean {
  if (rule.kind && rule.kind !== request.kind) return false
  if (rule.scope === "kind") return true
  if (rule.scope === "server") {
    return Boolean(rule.serverId && rule.serverId === request.serverId)
  }
  if (rule.scope === "tool") {
    return Boolean(
      rule.serverId &&
        rule.serverId === request.serverId &&
        rule.toolName &&
        rule.toolName === request.toolName,
    )
  }
  if (rule.action && rule.action !== request.action) return false
  if (rule.serverId && rule.serverId !== request.serverId) return false
  if (rule.toolName && rule.toolName !== request.toolName) return false
  if (rule.command && rule.command !== request.command) return false
  return true
}

function interpret(value: boolean | PermissionDecision): PermissionDecision {
  if (value === true) return "allow"
  if (value === false) return "deny"
  return value
}

function applyDecision(decision: PermissionDecision, request: PermissionRequest): boolean {
  if (decision === "allow_session") {
    grantSession(request)
    return true
  }
  if (decision === "allow_always") {
    grantAlways(request)
    return true
  }
  if (decision === "allow_server") {
    grantServerSession(request)
    return true
  }
  if (decision === "deny_session") {
    denySession(request)
    throw denied(request.action)
  }
  if (decision === "allow") return true
  throw denied(request.action)
}

export async function requestPermission(action: PermissionRequest): Promise<boolean> {
  const hit = matchRule(action)
  if (hit?.effect === "allow") return true
  if (hit?.effect === "deny") throw denied(action.action)

  if (!handler) {
    if (action.risk === "low") return true
    throw denied(action.action)
  }

  return applyDecision(interpret(await handler(action)), action)
}

export async function askPermission(action: PermissionRequest): Promise<boolean> {
  try {
    return await requestPermission(action)
  } catch {
    return false
  }
}
