const DEFAULT_BINS = [
  "git",
  "npm",
  "npx",
  "node",
  "tsx",
  "tsc",
  "python3",
  "python",
  "pip",
  "rg",
  "grep",
  "find",
  "ls",
  "cat",
  "head",
  "tail",
  "mkdir",
  "touch",
  "cp",
  "mv",
  "rm",
  "echo",
  "test",
  "true",
  "false",
  "pwd",
  "which",
  "env",
]

const DENIED_BINS = new Set([
  "sudo",
  "su",
  "chmod",
  "chown",
  "chgrp",
  "mount",
  "umount",
  "mkfs",
  "dd",
  "reboot",
  "shutdown",
  "systemctl",
  "service",
  "docker",
  "podman",
  "kubectl",
  "nsenter",
  "unshare",
  "iptables",
  "nft",
])

const DANGEROUS_FLAGS = ["--privileged", "--net=host", "--pid=host"]

export type ParsedCommand = {
  bin: string
  argv: string[]
}

export function tokenize(command: string): string[] {
  const out: string[] = []
  let cur = ""
  let quote: '"' | "'" | null = null
  let escape = false
  for (const ch of command) {
    if (escape) {
      cur += ch
      escape = false
      continue
    }
    if (ch === "\\" && quote !== "'") {
      escape = true
      continue
    }
    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        cur += ch
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }
    if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur)
        cur = ""
      }
      continue
    }
    if (ch === ";" || ch === "|" || ch === "&" || ch === "`") {
      throw new Error(`metacharacter ${ch} is not allowed`)
    }
    cur += ch
  }
  if (quote) throw new Error("unclosed quote")
  if (escape) throw new Error("dangling escape")
  if (cur) out.push(cur)
  return out
}

export function parseCommand(command: string): ParsedCommand {
  const argv = tokenize(command.trim())
  if (!argv.length) throw new Error("empty command")
  const bin = argv[0].split(/[/\\]/).pop() ?? argv[0]
  return { bin, argv }
}

export type Allowlist = {
  bins: Set<string>
}

export function defaultAllowlist(extra: string[] = []): Allowlist {
  return { bins: new Set([...DEFAULT_BINS, ...extra]) }
}

export function inspectCommand(
  command: string,
  allow: Allowlist,
): { ok: true; parsed: ParsedCommand } | { ok: false; reason: string } {
  let parsed: ParsedCommand
  try {
    parsed = parseCommand(command)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "invalid command" }
  }
  if (DENIED_BINS.has(parsed.bin)) {
    return { ok: false, reason: `${parsed.bin} is blocked` }
  }
  if (!allow.bins.has(parsed.bin)) {
    return { ok: false, reason: `${parsed.bin} is not on the command allowlist` }
  }
  if (parsed.bin === "rm" && parsed.argv.some((a) => a === "-rf" || a === "-fr" || a === "--recursive")) {
    const target = parsed.argv[parsed.argv.length - 1]
    if (target === "/" || target === "/*" || target === ".") {
      return { ok: false, reason: "refusing recursive delete of a root path" }
    }
  }
  for (const flag of DANGEROUS_FLAGS) {
    if (parsed.argv.includes(flag)) return { ok: false, reason: `${flag} is blocked` }
  }
  if (command.includes("$(") || command.includes("<(") || command.includes(">(")) {
    return { ok: false, reason: "command substitution is blocked" }
  }
  return { ok: true, parsed }
}
