import { mkdirSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"

export const DEFAULT_PORT = 3000
export const DEFAULT_DATA_DIR = "/data"
export const KEY_FILE = ".master.key"
export const STORE_FILE = "agent-core.db"
export const AUDIT_FILE = "audit.log"
export const WORKSPACE_DIR = "workspace"

export function resolveDataDir(override?: string): string {
  const raw = override ?? process.env.AGENT_CORE_DATA ?? DEFAULT_DATA_DIR
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw)
}

export function dataLayout(dataDir: string) {
  return {
    root: dataDir,
    keyPath: join(dataDir, KEY_FILE),
    storePath: join(dataDir, STORE_FILE),
    auditPath: join(dataDir, AUDIT_FILE),
    workspace: join(dataDir, WORKSPACE_DIR),
  }
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}
