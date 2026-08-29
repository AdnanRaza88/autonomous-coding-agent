import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { SharedSpec } from "@agent-core/types"
import { DeployError } from "./errors.js"
import { requestJson } from "./http.js"
import { slugFromName } from "./scan.js"
import type { DeployResult, DeployTarget, DeployTargetConfig } from "./types.js"

const ID = "fly"
const API = "https://api.machines.dev/v1"

export function createFlyTarget(): DeployTarget {
  return {
    id: ID,
    kind: "container",
    detect(spec: SharedSpec) {
      const hay = `${spec.goal} ${Object.values(spec.constraints).join(" ")}`.toLowerCase()
      return /(full-stack|fullstack|backend|api|docker|container|fly|server|postgres)/.test(hay)
    },
    async deploy(projectDir: string, config: DeployTargetConfig): Promise<DeployResult> {
      if (!config.token) {
        throw new DeployError({ message: "Fly token is missing", code: "missing_token", targetId: ID })
      }
      const app = slugFromName(config.projectName ?? inferAppName(projectDir))
      const image = config.image ?? readImageHint(projectDir) ?? "flyio/hellofly:latest"
      const region = config.region ?? "iad"
      const org = config.org ?? "personal"

      await ensureApp(config.token, app, org)
      const machine = (await requestJson({
        targetId: ID,
        url: `${API}/apps/${app}/machines`,
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}` },
        body: {
          region,
          config: {
            image,
            env: config.env ?? {},
            guest: { cpu_kind: "shared", cpus: 1, memory_mb: 256 },
            services: [
              {
                protocol: "tcp",
                internal_port: 8080,
                ports: [
                  { port: 443, handlers: ["tls", "http"] },
                  { port: 80, handlers: ["http"] },
                ],
              },
            ],
          },
        },
        timeoutMs: 45_000,
      })) as Record<string, unknown>

      const machineId = String(machine.id ?? "")
      const url = `https://${app}.fly.dev`
      if (!machineId) {
        return { url: "", status: "failed", targetId: ID, message: "Fly did not return a machine id" }
      }
      return { url, status: "live", targetId: ID, remoteId: machineId }
    },
  }
}

async function ensureApp(token: string, app: string, org: string): Promise<void> {
  try {
    await requestJson({
      targetId: ID,
      url: `${API}/apps/${app}`,
      headers: { Authorization: `Bearer ${token}` },
      retries: 0,
    })
    return
  } catch (err) {
    if (!(err instanceof DeployError) || err.code !== "not_found") throw err
  }
  await requestJson({
    targetId: ID,
    url: `${API}/apps`,
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { app_name: app, org_slug: org },
  })
}

function inferAppName(projectDir: string): string {
  const toml = join(projectDir, "fly.toml")
  if (existsSync(toml)) {
    const text = readFileSync(toml, "utf8")
    const match = text.match(/^\s*app\s*=\s*"([^"]+)"/m)
    if (match?.[1]) return match[1]
  }
  const leaf = projectDir.split(/[\\/]/).filter(Boolean).pop()
  return leaf ?? "agent-core-app"
}

function readImageHint(projectDir: string): string | undefined {
  const toml = join(projectDir, "fly.toml")
  if (!existsSync(toml)) return undefined
  const text = readFileSync(toml, "utf8")
  const match = text.match(/^\s*image\s*=\s*"([^"]+)"/m)
  return match?.[1]
}
