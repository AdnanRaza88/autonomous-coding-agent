import type { SlashCommandInfo } from "../api/contract.js"

export function parseComposer(input: string): { slash: boolean; query: string; args: string[] } {
  if (!input.startsWith("/")) return { slash: false, query: input, args: [] }
  const trimmed = input.slice(1)
  const parts = trimmed.split(/\s+/).filter(Boolean)
  return { slash: true, query: parts[0] ?? "", args: parts.slice(1) }
}

export function filterCommands(commands: SlashCommandInfo[], query: string): SlashCommandInfo[] {
  const q = query.replace(/^\//, "").toLowerCase()
  if (!q) return commands
  return commands.filter((cmd) => matchesCommand(cmd, q))
}

function matchesCommand(cmd: SlashCommandInfo, q: string): boolean {
  const name = cmd.name.toLowerCase()
  if (name.startsWith(q) || name.includes(q)) return true
  return tokenize(cmd.description).some((token) => token.startsWith(q))
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}
