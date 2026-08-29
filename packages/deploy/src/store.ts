import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { decryptSecret, encryptSecret, type EncryptedBlob } from "./crypto.js"
import { storeFail } from "./errors.js"
import { ensureDir } from "./paths.js"

export type StoredSecret = {
  id: string
  kind: "provider" | "mcp" | "other"
  ciphertext: EncryptedBlob
  updatedAt: string
}

export type StoredProvider = {
  id: string
  baseUrl: string
  model: string
  contextWindow: number
  secretId: string
}

export type StoredSubagent = {
  id: string
  name: string
  definition: unknown
  updatedAt: string
}

export type StoredRun = {
  id: string
  goal: string
  status: string
  createdAt: string
  payload?: unknown
}

type StoreDoc = {
  version: 1
  secrets: StoredSecret[]
  providers: StoredProvider[]
  subagents: StoredSubagent[]
  runs: StoredRun[]
}

const emptyDoc = (): StoreDoc => ({
  version: 1,
  secrets: [],
  providers: [],
  subagents: [],
  runs: [],
})

export class ConfigStore {
  private doc: StoreDoc

  constructor(
    private readonly path: string,
    private readonly master: Buffer,
  ) {
    this.doc = this.read()
  }

  private read(): StoreDoc {
    if (!existsSync(this.path)) return emptyDoc()
    const raw = readFileSync(this.path, "utf8")
    if (!raw.trim()) return emptyDoc()
    try {
      const parsed = JSON.parse(raw) as StoreDoc
      if (parsed.version !== 1) throw storeFail(`unknown store version ${String((parsed as { version?: unknown }).version)}`)
      return {
        version: 1,
        secrets: parsed.secrets ?? [],
        providers: parsed.providers ?? [],
        subagents: parsed.subagents ?? [],
        runs: parsed.runs ?? [],
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("unknown store")) throw err
      throw storeFail("corrupt data store")
    }
  }

  private persist(): void {
    ensureDir(dirname(this.path))
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(this.doc), { encoding: "utf8", mode: 0o600 })
    renameSync(tmp, this.path)
  }

  putSecret(id: string, kind: StoredSecret["kind"], plaintext: string): StoredSecret {
    const row: StoredSecret = {
      id,
      kind,
      ciphertext: encryptSecret(this.master, plaintext),
      updatedAt: new Date().toISOString(),
    }
    this.doc.secrets = this.doc.secrets.filter((s) => s.id !== id)
    this.doc.secrets.push(row)
    this.persist()
    return row
  }

  getSecretPlain(id: string): string | undefined {
    const row = this.doc.secrets.find((s) => s.id === id)
    if (!row) return undefined
    return decryptSecret(this.master, row.ciphertext)
  }

  listSecretIds(kind?: StoredSecret["kind"]): Array<{ id: string; kind: StoredSecret["kind"]; updatedAt: string }> {
    return this.doc.secrets
      .filter((s) => !kind || s.kind === kind)
      .map((s) => ({ id: s.id, kind: s.kind, updatedAt: s.updatedAt }))
  }

  deleteSecret(id: string): boolean {
    const before = this.doc.secrets.length
    this.doc.secrets = this.doc.secrets.filter((s) => s.id !== id)
    if (this.doc.secrets.length === before) return false
    this.persist()
    return true
  }

  upsertProvider(row: StoredProvider): void {
    this.doc.providers = this.doc.providers.filter((p) => p.id !== row.id)
    this.doc.providers.push(row)
    this.persist()
  }

  getProvider(id: string): StoredProvider | undefined {
    return this.doc.providers.find((p) => p.id === id)
  }

  listProviders(): StoredProvider[] {
    return [...this.doc.providers]
  }

  upsertSubagent(row: StoredSubagent): void {
    this.doc.subagents = this.doc.subagents.filter((s) => s.id !== row.id)
    this.doc.subagents.push(row)
    this.persist()
  }

  listSubagents(): StoredSubagent[] {
    return [...this.doc.subagents]
  }

  deleteSubagent(id: string): boolean {
    const before = this.doc.subagents.length
    this.doc.subagents = this.doc.subagents.filter((s) => s.id !== id)
    if (this.doc.subagents.length === before) return false
    this.persist()
    return true
  }

  upsertRun(row: StoredRun): void {
    this.doc.runs = this.doc.runs.filter((r) => r.id !== row.id)
    this.doc.runs.push(row)
    this.persist()
  }

  getRun(id: string): StoredRun | undefined {
    return this.doc.runs.find((r) => r.id === id)
  }

  listRuns(): StoredRun[] {
    return [...this.doc.runs]
  }

  snapshot(): StoreDoc {
    return structuredClone(this.doc)
  }
}

export function openStore(storePath: string, master: Buffer): ConfigStore {
  return new ConfigStore(storePath, master)
}
