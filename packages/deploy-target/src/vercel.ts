import type { SharedSpec } from "@agent-core/types"
import { DeployError } from "./errors.js"
import { requestJson } from "./http.js"
import { collectProjectFiles, slugFromName } from "./scan.js"
import type { DeployResult, DeployTarget, DeployTargetConfig } from "./types.js"

const ID = "vercel"
const API = "https://api.vercel.com"

export function createVercelTarget(opts?: { fetchDeployment?: typeof pollDeployment }): DeployTarget {
  const wait = opts?.fetchDeployment ?? pollDeployment
  return {
    id: ID,
    kind: "static",
    detect(spec: SharedSpec) {
      const hay = `${spec.goal} ${Object.values(spec.constraints).join(" ")}`.toLowerCase()
      if (/(docker|container|fly|backend-only)/.test(hay) && !/(static|frontend|vite|vercel)/.test(hay)) {
        return false
      }
      return /(static|frontend|vite|spa|html|vercel|landing)/.test(hay) || !/(backend|api server|postgres)/.test(hay)
    },
    async deploy(projectDir: string, config: DeployTargetConfig): Promise<DeployResult> {
      if (!config.token) {
        throw new DeployError({ message: "Vercel token is missing", code: "missing_token", targetId: ID })
      }
      const files = collectProjectFiles(projectDir)
      const name = slugFromName(config.projectName ?? inferName(projectDir, files))
      const team = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : ""

      for (const file of files) {
        await requestJson({
          targetId: ID,
          url: `${API}/v2/files${team}`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Length": String(file.size),
            "x-vercel-digest": file.sha1,
            "x-vercel-filename": file.path,
          },
          rawBody: file.data,
          timeoutMs: 60_000,
          retries: 1,
        })
      }

      const created = (await requestJson({
        targetId: ID,
        url: `${API}/v13/deployments${team}`,
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}` },
        body: {
          name,
          project: name,
          target: config.production === false ? "preview" : "production",
          files: files.map((f) => ({ file: f.path, sha: f.sha1, size: f.size })),
          projectSettings: {
            framework: config.framework ?? inferFramework(files),
          },
        },
        timeoutMs: 60_000,
      })) as Record<string, unknown>

      const deploymentId = String(created.id ?? created.uid ?? "")
      const readyUrl = typeof created.url === "string" ? withHttps(created.url) : ""
      if (!deploymentId) {
        throw new DeployError({
          message: "Vercel did not return a deployment id",
          code: "build_error",
          targetId: ID,
        })
      }

      const ready = await wait(config.token, deploymentId, config.teamId)
      const url = ready.url || readyUrl
      if (ready.readyState === "ERROR" || ready.readyState === "CANCELED") {
        return {
          url: url || "",
          status: "failed",
          targetId: ID,
          remoteId: deploymentId,
          message: ready.error || "Vercel build failed",
        }
      }
      return { url, status: "live", targetId: ID, remoteId: deploymentId }
    },
  }
}

async function pollDeployment(
  token: string,
  id: string,
  teamId?: string,
): Promise<{ readyState: string; url: string; error?: string }> {
  const team = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
  for (let i = 0; i < 40; i++) {
    const raw = (await requestJson({
      targetId: ID,
      url: `${API}/v13/deployments/${id}${team}`,
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 20_000,
      retries: 1,
    })) as Record<string, unknown>
    const readyState = String(raw.readyState ?? raw.status ?? "")
    const url = typeof raw.url === "string" ? withHttps(raw.url) : ""
    if (readyState === "READY") return { readyState, url }
    if (readyState === "ERROR" || readyState === "CANCELED") {
      const errObj = raw.errorMessage ?? raw.error
      const error = typeof errObj === "string" ? errObj : JSON.stringify(errObj ?? "")
      return { readyState, url, error }
    }
    await delay(1_500)
  }
  throw new DeployError({
    message: `Vercel deployment ${id} timed out waiting for READY`,
    code: "timeout",
    targetId: ID,
  })
}

function inferName(projectDir: string, files: { path: string }[]): string {
  const pkg = files.find((f) => f.path === "package.json")
  if (pkg) return "agent-core-app"
  const leaf = projectDir.split(/[\\/]/).filter(Boolean).pop()
  return leaf ?? "agent-core-app"
}

function inferFramework(files: { path: string }[]): string | null {
  const names = new Set(files.map((f) => f.path))
  if (names.has("next.config.js") || names.has("next.config.mjs") || names.has("next.config.ts")) return "nextjs"
  if (names.has("vite.config.ts") || names.has("vite.config.js")) return "vite"
  if (names.has("astro.config.mjs") || names.has("astro.config.ts")) return "astro"
  if (names.has("index.html")) return null
  return null
}

function withHttps(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `https://${url}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
