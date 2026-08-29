import { resolve } from "node:path"

export function encodeWorkspaceKey(workspace: string): string {
  const abs = resolve(workspace)
  return Buffer.from(abs, "utf8").toString("base64url")
}

export function decodeWorkspaceKey(key: string): string {
  const decoded = Buffer.from(key, "base64url").toString("utf8")
  if (!looksLikePath(decoded)) {
    throw new Error("not a workspace key")
  }
  return decoded
}

export function isWorkspaceKey(key: string): boolean {
  try {
    decodeWorkspaceKey(key)
    return true
  } catch {
    return false
  }
}

function looksLikePath(value: string): boolean {
  if (!value || value.length > 4096) return false
  if (value.includes("\0")) return false
  if (value.startsWith("/") || value.startsWith("\\")) return true
  return /^[A-Za-z]:[\\/]/.test(value)
}

export function sidebarPath(workspace: string): string {
  return `/${encodeWorkspaceKey(workspace)}/`
}
