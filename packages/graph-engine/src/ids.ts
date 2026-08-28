import { randomBytes } from "node:crypto"

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`
}

export function slugId(index: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
  return slug ? `t${index + 1}-${slug}` : `t${index + 1}`
}

export function normalizeTaskId(raw: string, fallbackIndex: number): string {
  const trimmed = raw.trim().toLowerCase()
  if (/^t\d+$/.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9_-]{0,40}$/.test(trimmed)) return trimmed
  return `t${fallbackIndex + 1}`
}
