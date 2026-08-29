import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { SharedSpec } from "@agent-core/types"
import type { DetectedProject, ProjectKind } from "./types.js"

const STATIC_HINTS = [
  "static",
  "static site",
  "frontend only",
  "frontend-only",
  "landing page",
  "vite",
  "spa",
  "html",
  "docs site",
]

const CONTAINER_HINTS = [
  "full-stack",
  "fullstack",
  "backend",
  "api",
  "server",
  "express",
  "fastify",
  "docker",
  "container",
  "postgres",
  "database",
  "websocket",
]

const SERVER_DEPS = [
  "express",
  "fastify",
  "koa",
  "hono",
  "nestjs",
  "@nestjs/core",
  "elysia",
  "next",
]

export function detectProjectKind(spec: SharedSpec, projectDir?: string): DetectedProject {
  const reasons: string[] = []
  const fromConstraints = kindFromConstraints(spec.constraints)
  if (fromConstraints) {
    reasons.push(`constraints.${fromConstraints.source}=${fromConstraints.kind}`)
    return { kind: fromConstraints.kind, framework: fromConstraints.framework, reasons }
  }

  if (projectDir) {
    const fromDisk = kindFromDisk(projectDir)
    if (fromDisk) return fromDisk
  }

  const hay = `${spec.goal} ${Object.values(spec.constraints).join(" ")}`.toLowerCase()
  const containerHits = CONTAINER_HINTS.filter((h) => hay.includes(h))
  const staticHits = STATIC_HINTS.filter((h) => hay.includes(h))
  if (containerHits.length && containerHits.length >= staticHits.length) {
    reasons.push(`goal mentions ${containerHits.join(", ")}`)
    return { kind: "container", reasons }
  }
  if (staticHits.length) {
    reasons.push(`goal mentions ${staticHits.join(", ")}`)
    return { kind: "static", reasons }
  }

  reasons.push("default static")
  return { kind: "static", reasons }
}

function kindFromConstraints(constraints: Record<string, string>): {
  kind: ProjectKind
  source: string
  framework?: string
} | null {
  const keys = ["kind", "type", "stack", "runtime", "host", "deploy", "target"]
  for (const key of keys) {
    const raw = constraints[key]
    if (!raw) continue
    const value = raw.toLowerCase()
    if (/(container|docker|fullstack|full-stack|backend|node|fly)/.test(value)) {
      return { kind: "container", source: key, framework: raw }
    }
    if (/(static|frontend|vite|spa|html|vercel|netlify)/.test(value)) {
      return { kind: "static", source: key, framework: raw }
    }
  }
  return null
}

function kindFromDisk(projectDir: string): DetectedProject | null {
  const reasons: string[] = []
  if (existsSync(join(projectDir, "Dockerfile")) || existsSync(join(projectDir, "fly.toml"))) {
    reasons.push("Dockerfile or fly.toml present")
    return { kind: "container", reasons }
  }
  const pkgPath = join(projectDir, "package.json")
  if (existsSync(pkgPath)) {
    const pkg = readJson(pkgPath)
    const deps = { ...asRecord(pkg.dependencies), ...asRecord(pkg.devDependencies) }
    const hit = SERVER_DEPS.find((name) => Object.prototype.hasOwnProperty.call(deps, name))
    if (hit) {
      reasons.push(`package.json depends on ${hit}`)
      return { kind: "container", framework: hit, reasons }
    }
    if (typeof pkg.scripts === "object" && pkg.scripts && "start" in (pkg.scripts as object)) {
      reasons.push("package.json has start script")
      return { kind: "container", reasons }
    }
  }
  if (existsSync(join(projectDir, "index.html")) || existsSync(join(projectDir, "vercel.json"))) {
    reasons.push("index.html or vercel.json present")
    return { kind: "static", reasons }
  }
  return null
}

function readJson(path: string): Record<string, unknown> {
  try {
    const raw = readFileSync(path, "utf8")
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}
