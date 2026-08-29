import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { IdeShellError } from "./errors.js"
import type { AppliedChange, DiffOpenRequest, ProposedChange } from "./types.js"

export class DiffBridge {
  private readonly pending = new Map<string, ProposedChange>()
  private readonly staging: string

  constructor(stagingDir?: string) {
    this.staging = stagingDir ?? join(tmpdir(), "agent-core-diff")
    mkdirSync(this.staging, { recursive: true })
  }

  propose(change: Omit<ProposedChange, "id"> & { id?: string }): DiffOpenRequest {
    const id = change.id ?? randomUUID()
    const stored: ProposedChange = { ...change, id, workspacePath: resolve(change.workspacePath) }
    this.pending.set(id, stored)
    const stamp = createHash("sha1").update(id).digest("hex").slice(0, 10)
    const left = join(this.staging, `${stamp}-original`)
    const right = join(this.staging, `${stamp}-proposed`)
    writeFileSync(left, stored.original)
    writeFileSync(right, stored.proposed)
    return {
      leftUri: fileUri(left),
      rightUri: fileUri(right),
      title: `${stored.workspacePath} (agent proposal)`,
      change: stored,
    }
  }

  get(id: string): ProposedChange | undefined {
    return this.pending.get(id)
  }

  list(): ProposedChange[] {
    return [...this.pending.values()]
  }

  accept(id: string): AppliedChange {
    const change = this.pending.get(id)
    if (!change) throw new IdeShellError("unknown_change", `no pending change ${id}`)
    mkdirSync(dirname(change.workspacePath), { recursive: true })
    writeFileSync(change.workspacePath, change.proposed)
    this.pending.delete(id)
    return { id, workspacePath: change.workspacePath, contents: change.proposed }
  }

  reject(id: string): ProposedChange {
    const change = this.pending.get(id)
    if (!change) throw new IdeShellError("unknown_change", `no pending change ${id}`)
    this.pending.delete(id)
    return change
  }

  acceptPath(workspacePath: string): AppliedChange {
    const hit = [...this.pending.values()].find((c) => c.workspacePath === resolve(workspacePath))
    if (!hit) throw new IdeShellError("unknown_change", `no pending change for ${workspacePath}`)
    return this.accept(hit.id)
  }

  readWorkspace(path: string): string {
    return readFileSync(path, "utf8")
  }
}

function fileUri(abs: string): string {
  const normalized = abs.replace(/\\/g, "/")
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`
}
