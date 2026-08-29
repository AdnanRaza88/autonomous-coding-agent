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
  return commands.filter((cmd) => {
    return cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)
  })
}
