import { loadOrCreateMasterKey } from "./crypto.js"
import { dataLayout, ensureDir, resolveDataDir } from "./paths.js"
import { AuditLog } from "./audit.js"
import { openStore, type ConfigStore } from "./store.js"
import { createSandbox, type ExecutionSandbox } from "./sandbox.js"

export type Runtime = {
  dataDir: string
  master: Buffer
  store: ConfigStore
  audit: AuditLog
  sandbox: ExecutionSandbox
  layout: ReturnType<typeof dataLayout>
}

export type BootstrapOptions = {
  dataDir?: string
  masterKey?: string
  extraBins?: string[]
}

export function bootstrapRuntime(opts: BootstrapOptions = {}): Runtime {
  const dataDir = resolveDataDir(opts.dataDir)
  const layout = dataLayout(dataDir)
  ensureDir(layout.root)
  ensureDir(layout.workspace)
  const master = loadOrCreateMasterKey(layout.keyPath, opts.masterKey)
  const store = openStore(layout.storePath, master)
  const audit = new AuditLog(layout.auditPath)
  const sandbox = createSandbox({
    root: layout.workspace,
    audit,
    extraBins: opts.extraBins,
  })
  return { dataDir, master, store, audit, sandbox, layout }
}
