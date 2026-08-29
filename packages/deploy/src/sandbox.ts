import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs"
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path"
import { defaultAllowlist, inspectCommand, type Allowlist } from "./allowlist.js"
import { AuditLog } from "./audit.js"
import { blocked } from "./errors.js"

export type SandboxOptions = {
  root: string
  audit: AuditLog
  extraBins?: string[]
}

export class ExecutionSandbox {
  readonly root: string
  private readonly allow: Allowlist
  private readonly audit: AuditLog

  constructor(opts: SandboxOptions) {
    this.root = resolve(opts.root)
    mkdirSync(this.root, { recursive: true })
    this.allow = defaultAllowlist(opts.extraBins)
    this.audit = opts.audit
  }

  resolveInside(input: string): string {
    const candidate = isAbsolute(input) ? normalize(input) : resolve(this.root, input)
    if (this.escapes(candidate)) {
      this.deny("fs.resolve", input, candidate)
    }
    if (existsSync(candidate)) {
      const stat = lstatSync(candidate)
      if (stat.isSymbolicLink()) {
        const real = realpathSync(candidate)
        if (this.escapes(real)) this.deny("fs.symlink", input, real)
        return real
      }
    }
    return candidate
  }

  assertReadable(input: string): string {
    return this.resolveInside(input)
  }

  assertWritable(input: string): string {
    const resolved = this.resolveInside(input)
    const parent = this.nearestExisting(resolved)
    if (this.escapes(parent)) this.deny("fs.write", input, parent)
    return resolved
  }

  allowCommand(command: string): { bin: string; argv: string[] } {
    const result = inspectCommand(command, this.allow)
    if (!result.ok) {
      this.audit.write({
        action: "shell.exec",
        allowed: false,
        detail: result.reason,
        command,
      })
      throw blocked(result.reason)
    }
    for (const arg of result.parsed.argv.slice(1)) {
      if (looksLikePath(arg)) {
        this.assertReadable(arg)
      }
    }
    this.audit.write({
      action: "shell.exec",
      allowed: true,
      detail: result.parsed.bin,
      command,
    })
    return result.parsed
  }

  private nearestExisting(path: string): string {
    let cur = path
    while (!existsSync(cur)) {
      const parent = resolve(cur, "..")
      if (parent === cur) break
      cur = parent
    }
    return cur
  }

  private escapes(path: string): boolean {
    const rel = relative(this.root, path)
    if (!rel) return false
    if (rel === "..") return true
    if (rel.startsWith(`..${sep}`)) return true
    if (isAbsolute(rel)) return true
    return false
  }

  private deny(action: string, input: string, resolved: string): never {
    this.audit.write({
      action,
      allowed: false,
      detail: "path escapes sandbox",
      path: resolved,
    })
    throw blocked(`path escapes sandbox: ${input}`, resolved)
  }
}

function looksLikePath(arg: string): boolean {
  if (!arg) return false
  if (arg.startsWith("-")) return false
  if (arg.includes("/") || arg.includes("\\")) return true
  if (arg === "." || arg === "..") return true
  return false
}

export function createSandbox(opts: SandboxOptions): ExecutionSandbox {
  return new ExecutionSandbox(opts)
}

export function joinWorkspace(root: string, ...parts: string[]): string {
  return join(root, ...parts)
}
