import { spawn as spawnChild } from "node:child_process"
import { IdeShellError } from "./errors.js"
import { healthUrl, probeHttp, waitHealthy } from "./health.js"
import {
  DEFAULT_BACKEND_PORT,
  LOOPBACK,
  loopbackOrigin,
  nextFreePort,
  portFree,
} from "./ports.js"
import type {
  AgentServeHandle,
  HealthProbe,
  ProcessSpawner,
  ServeManagerOptions,
  ServeState,
  SpawnedProcess,
} from "./types.js"

const DEFAULT_CMD = process.execPath

function defaultSpawn(req: {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  cwd: string
}): SpawnedProcess {
  const child = spawnChild(req.command, req.args, {
    cwd: req.cwd,
    env: req.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  })
  if (child.pid == null) {
    throw new IdeShellError("spawn_failed", `failed to spawn ${req.command}`)
  }
  return {
    pid: child.pid,
    kill: (signal) => {
      try {
        return child.kill(signal ?? "SIGTERM")
      } catch {
        return false
      }
    },
  }
}

function defaultArgs(port: number): string[] {
  return ["--import", "tsx", "packages/deploy/src/cli.ts", "--", String(port)]
}

export class AgentServeManager {
  private state: ServeState = "stopped"
  private child?: SpawnedProcess
  private port = DEFAULT_BACKEND_PORT
  private readonly opts: Required<
    Pick<
      ServeManagerOptions,
      | "command"
      | "args"
      | "cwd"
      | "preferredPort"
      | "host"
      | "healthPath"
      | "probeIntervalMs"
      | "probeTimeoutMs"
      | "readyTimeoutMs"
      | "maxPortAttempts"
    >
  > & { env: NodeJS.ProcessEnv; spawn: ProcessSpawner; probe: HealthProbe }

  constructor(opts: ServeManagerOptions = {}) {
    this.opts = {
      command: opts.command ?? process.env.AGENT_CORE_SERVE_BIN ?? DEFAULT_CMD,
      args: opts.args ?? [],
      cwd: opts.cwd ?? process.cwd(),
      preferredPort: opts.preferredPort ?? Number(process.env.AGENT_CORE_BACKEND_PORT ?? DEFAULT_BACKEND_PORT),
      host: opts.host ?? LOOPBACK,
      healthPath: opts.healthPath ?? "/api/health",
      probeIntervalMs: opts.probeIntervalMs ?? 150,
      probeTimeoutMs: opts.probeTimeoutMs ?? 400,
      readyTimeoutMs: opts.readyTimeoutMs ?? 8000,
      maxPortAttempts: opts.maxPortAttempts ?? 16,
      env: { ...process.env, ...(opts.env ?? {}) },
      spawn: opts.spawn ?? defaultSpawn,
      probe: opts.probe ?? probeHttp,
    }
  }

  currentState(): ServeState {
    return this.state
  }

  async start(): Promise<AgentServeHandle> {
    if (this.state === "healthy" && this.child) {
      return this.handle()
    }
    this.state = "starting"
    this.port = await this.pickPort()
    const args = this.opts.args.length > 0 ? this.opts.args : defaultArgs(this.port)
    const env: NodeJS.ProcessEnv = {
      ...this.opts.env,
      PORT: String(this.port),
      HOST: this.opts.host,
      NO_PROXY: mergeNoProxy(this.opts.env.NO_PROXY),
      no_proxy: mergeNoProxy(this.opts.env.no_proxy ?? this.opts.env.NO_PROXY),
    }
    this.child = this.opts.spawn({
      command: this.opts.command,
      args,
      env,
      cwd: this.opts.cwd,
      port: this.port,
    })
    const url = healthUrl(this.port, this.opts.healthPath)
    const ok = await waitHealthy(url, this.opts.readyTimeoutMs, this.opts.probeIntervalMs, this.opts.probe)
    if (!ok) {
      this.state = "recovering"
      const recovered = await this.recover()
      if (!recovered) {
        await this.stop()
        throw new IdeShellError("backend_unhealthy", `health probe failed at ${url}`)
      }
    }
    this.state = "healthy"
    return this.handle()
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill("SIGTERM")
      this.child = undefined
    }
    this.state = "stopped"
  }

  private async pickPort(): Promise<number> {
    if (await portFree(this.opts.preferredPort, this.opts.host)) {
      return this.opts.preferredPort
    }
    this.state = "recovering"
    return nextFreePort(this.opts.preferredPort + 1, this.opts.host, this.opts.maxPortAttempts)
  }

  private async recover(): Promise<boolean> {
    const next = await nextFreePort(this.port + 1, this.opts.host, this.opts.maxPortAttempts)
    if (this.child) this.child.kill("SIGTERM")
    this.port = next
    const args = this.opts.args.length > 0 ? rewritePortArg(this.opts.args, next) : defaultArgs(next)
    this.child = this.opts.spawn({
      command: this.opts.command,
      args,
      env: { ...this.opts.env, PORT: String(next), HOST: this.opts.host },
      cwd: this.opts.cwd,
      port: next,
    })
    return waitHealthy(
      healthUrl(next, this.opts.healthPath),
      this.opts.readyTimeoutMs,
      this.opts.probeIntervalMs,
      this.opts.probe,
    )
  }

  private handle(): AgentServeHandle {
    const port = this.port
    return {
      state: this.state,
      endpoints: {
        health: healthUrl(port, this.opts.healthPath),
        origin: loopbackOrigin(port),
        port,
      },
      pid: this.child?.pid,
      stop: () => this.stop(),
    }
  }
}

function mergeNoProxy(existing: string | undefined): string {
  const parts = (existing ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    if (!parts.some((p) => p.toLowerCase() === host)) parts.push(host)
  }
  return parts.join(",")
}

function rewritePortArg(args: string[], port: number): string[] {
  const out = [...args]
  const flag = out.findIndex((a) => a === "--port" || a === "-p")
  if (flag >= 0 && out[flag + 1]) {
    out[flag + 1] = String(port)
    return out
  }
  const last = out[out.length - 1]
  if (last && /^\d+$/.test(last)) {
    out[out.length - 1] = String(port)
    return out
  }
  return out
}
