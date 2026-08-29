import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { AgentServeManager } from "./serve-manager.js"
import { startSpaProxy, type SpaProxyHandle } from "./spa-proxy.js"
import { DiffBridge } from "./diff.js"
import { extensionManifest, sidebarHtml } from "./contributions.js"
import { IdeShellError } from "./errors.js"
import { watchIdeRun, type LiveHandle } from "./live.js"
import { DEFAULT_PROXY_PORT } from "./ports.js"
import { encodeWorkspaceKey } from "./workspace.js"
import type { AgentServeHandle, IdeHostOptions, SidebarTarget, StatusSnapshot } from "./types.js"

export interface IdeHost {
  serve: AgentServeHandle
  proxy: SpaProxyHandle
  diffs: DiffBridge
  sidebar: SidebarTarget
  manifest: Record<string, unknown>
  html: string
  watchRun: (runId: string, onStatus: (status: StatusSnapshot) => void) => LiveHandle
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
      const handle = watchIdeRun({
        origin: serve.endpoints.origin,
        runId,
        onStatus,
      })
      live.push(handle)
      return handle
    },
    stop: async () => {
      for (const handle of live) handle.close()
      await proxy.close()
      await serve.stop()
    },
  }
}
