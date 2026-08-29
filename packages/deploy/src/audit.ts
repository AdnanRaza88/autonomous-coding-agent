import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { dirname } from "node:path"
import { ensureDir } from "./paths.js"

export type AuditEvent = {
  at: string
  action: string
  allowed: boolean
  detail: string
  path?: string
  command?: string
}

export class AuditLog {
  constructor(private readonly path: string) {}

  write(event: Omit<AuditEvent, "at">): AuditEvent {
    const row: AuditEvent = { at: new Date().toISOString(), ...event }
    ensureDir(dirname(this.path))
    appendFileSync(this.path, `${JSON.stringify(row)}\n`, "utf8")
    return row
  }

  recent(limit = 100): AuditEvent[] {
    if (!existsSync(this.path)) return []
    const lines = readFileSync(this.path, "utf8").split("\n").filter(Boolean)
    const slice = lines.slice(Math.max(0, lines.length - limit))
    const out: AuditEvent[] = []
    for (const line of slice) {
      try {
        out.push(JSON.parse(line) as AuditEvent)
      } catch {
        continue
      }
    }
    return out
  }
}
