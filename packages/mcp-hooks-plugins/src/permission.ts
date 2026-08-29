import { denied } from "./errors.js"
import type { PermissionDecision, PermissionHandler, PermissionRequest } from "./types.js"

const sessionGrants = new Set<string>()
const alwaysGrants = new Set<string>()
let handler: PermissionHandler | undefined

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

export function grantAlways(request: PermissionRequest): void {
  alwaysGrants.add(permissionKey(request))
}

export function grantSession(request: PermissionRequest): void {
  sessionGrants.add(permissionKey(request))
}

export function revokeGrants(): void {
  sessionGrants.clear()
  alwaysGrants.clear()
}

export function clearSessionGrants(): void {
  sessionGrants.clear()
}

function interpret(value: boolean | PermissionDecision): PermissionDecision {
  if (value === true) return "allow"
  if (value === false) return "deny"
  return value
}

export async function requestPermission(action: PermissionRequest): Promise<boolean> {
  const key = permissionKey(action)
  if (alwaysGrants.has(key) || sessionGrants.has(key)) return true

  if (!handler) {
    if (action.risk === "low") return true
    throw denied(action.action)
  }

  const decision = interpret(await handler(action))
  if (decision === "allow_session") {
    sessionGrants.add(key)
    return true
  }
  if (decision === "allow") return true
  throw denied(action.action)
}

export async function askPermission(action: PermissionRequest): Promise<boolean> {
  try {
    return await requestPermission(action)
  } catch {
    return false
  }
}
