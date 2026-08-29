import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { AgentServeManager } from "./serve-manager.js"
import { startSpaProxy, type SpaProxyHandle } from "./spa-proxy.js"
import { DiffBridge } from "./diff.js"
import { extensionManifest, sidebarHtml } from "./contributions.js"
import { IdeShellError } from "./errors.js"
import { cancelIdeRun, watchIdeRun, type LiveHandle } from "./live.js"
import {
  deployRun,
  detectDeploy,
  fetchDeployTargets,
  fetchMemoryHealth,
  fetchVaultGraph,
  fetchVaultNotes,
  watchIdeDeploy,
  type DeployResultInfo,
  type DetectedProjectInfo,
  type MemoryHealth,
  type PlaneHandle,
  type VaultGraphSnapshot,
} from "./plane.js"
import { DEFAULT_PROXY_PORT } from "./ports.js"
import { encodeWorkspaceKey } from "./workspace.js"
import type {
  AgentServeHandle,
  DeployProgressView,
  IdeHostOptions,
  SidebarTarget,
  StatusSnapshot,
} from "./types.js"

export interface IdeHost {
  serve: AgentServeHandle
  proxy: SpaProxyHandle
  diffs: DiffBridge
  sidebar: SidebarTarget
  manifest: Record<string, unknown>
  html: string
  watchRun: (runId: string, onStatus: (status: StatusSnapshot) => void) => LiveHandle
  watchDeploy: (runId: string, onProgress: (event: DeployProgressView) => void) => PlaneHandle
  cancelRun: (runId?: string) => Promise<{ runId: string; cancelled: boolean; status?: string }>
  memoryHealth: () => Promise<MemoryHealth>
  vaultGraph: () => Promise<VaultGraphSnapshot>
  vaultNotes: () => Promise<{ id: string; title: string }[]>
  deployTargets: () => Promise<{ id: string; kind: "static" | "container" }[]>
  detectDeploy: (runId: string) => Promise<DetectedProjectInfo>
  deployRun: (body: {
    runId: string
    targetId?: string
    token?: string
    projectName?: string
  }) => Promise<DeployResultInfo>
  activeRunId: () => string | undefined
  stop: () => Promise<void>
}

export function guessSpaRoot(from = process.cwd()): string | undefined {
  const candidates = [
    process.env.AGENT_CORE_WEB_ROOT,
    join(from, "packages/web/dist"),
    join(from, "apps/ide/vendor/web"),
  ]
  return candidates.find((p) => p && existsSync(join(p, "index.html")))
}

export async function createIdeHost(opts: IdeHostOptions = {}): Promise<IdeHost> {
  const workspace = resolve(opts.workspace ?? process.cwd())
  const spaRoot = opts.spaRoot ?? guessSpaRoot(opts.cwd ?? process.cwd())
  if (!spaRoot) {
    throw new IdeShellError("spa_missing", "web SPA build not found; set AGENT_CORE_WEB_ROOT or build packages/web")
  }
  const manager = new AgentServeManager(opts)
  const serve = await manager.start()
  const proxy = await startSpaProxy({
    spaRoot,
    backendOrigin: serve.endpoints.origin,
    port: opts.proxyPort ?? Number(process.env.AGENT_CORE_PROXY_PORT ?? DEFAULT_PROXY_PORT),
    workspace,
  })
  const iframeUrl = proxy.iframeUrl(workspace)
  const diffs = new DiffBridge()
  const live: LiveHandle[] = []
  const deployWatches: PlaneHandle[] = []
  let activeRunId: string | undefined
  const origin = () => serve.endpoints.origin
  return {
    serve,
    proxy,
    diffs,
    sidebar: {
      origin: proxy.origin,
      iframeUrl,
      workspaceKey: encodeWorkspaceKey(workspace),
    },
    manifest: extensionManifest(),
    html: sidebarHtml(iframeUrl),
    watchRun(runId, onStatus) {
      activeRunId = runId
      const handle = watchIdeRun({
        origin: serve.endpoints.origin,
        runId,
        onStatus: (status) => {
          if (status.phase === "done" || status.phase === "error") {
            if (activeRunId === runId) activeRunId = undefined
          }
          onStatus(status)
        },
      })
      live.push(handle)
      return handle
    },
    activeRunId: () => activeRunId,
    watchDeploy(runId, onProgress) {
      const handle = watchIdeDeploy({
        origin: origin(),
        runId,
        onProgress,
      })
      deployWatches.push(handle)
      return handle
    },
    memoryHealth: () => fetchMemoryHealth(origin()),
    vaultGraph: () => fetchVaultGraph(origin()),
    vaultNotes: () => fetchVaultNotes(origin()),
    deployTargets: () => fetchDeployTargets(origin()),
    detectDeploy: (runId) => detectDeploy(origin(), runId),
    deployRun: (body) => deployRun(origin(), body),
    async cancelRun(runId) {
      const id = runId ?? activeRunId
      if (!id) throw new IdeShellError("no_run", "no active run to cancel")
      return cancelIdeRun(serve.endpoints.origin, id)
    },
    stop: async () => {
      for (const handle of live) handle.close()
      for (const handle of deployWatches) handle.close()
      await proxy.close()
      await serve.stop()
    },
  }
}
