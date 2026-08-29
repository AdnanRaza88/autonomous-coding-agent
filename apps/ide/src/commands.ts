import type { SlashPaletteCommand } from "./types.js"

export const BUILTIN_SLASH: Array<{
  name: string
  description: string
  risk: "low" | "medium" | "high"
}> = [
  { name: "help", description: "List slash commands", risk: "low" },
  { name: "commands", description: "Print command names", risk: "low" },
  { name: "cwd", description: "Show working directory", risk: "low" },
  { name: "read", description: "Read a file through the filesystem MCP server", risk: "low" },
  { name: "write", description: "Write a file through the filesystem MCP server", risk: "high" },
  { name: "ls", description: "List a directory", risk: "low" },
  { name: "tree", description: "Directory tree", risk: "low" },
  { name: "search", description: "Search file contents", risk: "low" },
  { name: "mkdir", description: "Create a directory", risk: "medium" },
  { name: "rm", description: "Delete a path", risk: "high" },
  { name: "mv", description: "Move a file", risk: "medium" },
  { name: "cp", description: "Copy by reading then writing", risk: "medium" },
  { name: "cat", description: "Alias for read", risk: "low" },
  { name: "status", description: "Git status", risk: "low" },
  { name: "diff", description: "Git diff", risk: "low" },
  { name: "log", description: "Git log", risk: "low" },
  { name: "branch", description: "List or create a branch", risk: "medium" },
  { name: "checkout", description: "Checkout a ref", risk: "high" },
  { name: "commit", description: "Create a commit", risk: "high" },
  { name: "stash", description: "Git stash", risk: "medium" },
  { name: "pull", description: "Git pull", risk: "high" },
  { name: "push", description: "Git push", risk: "high" },
  { name: "blame", description: "Git blame", risk: "low" },
  { name: "test", description: "Queue workspace tests", risk: "medium" },
  { name: "test-file", description: "Queue a single test file", risk: "medium" },
  { name: "coverage", description: "Queue coverage", risk: "low" },
  { name: "lint", description: "Queue lint", risk: "low" },
  { name: "typecheck", description: "Queue typecheck", risk: "low" },
  { name: "format", description: "Queue formatter", risk: "medium" },
  { name: "plan", description: "Ask the orchestrator to plan from the current spec", risk: "medium" },
  { name: "loop", description: "Re-run failed tasks", risk: "medium" },
  { name: "retry", description: "Retry one task", risk: "medium" },
  { name: "cancel", description: "Cancel the current run", risk: "high" },
  { name: "pause", description: "Pause the current run", risk: "medium" },
  { name: "resume", description: "Resume a paused run", risk: "medium" },
  { name: "run-status", description: "Show orchestrator run status", risk: "low" },
  { name: "blackboard", description: "Read or write the shared blackboard key", risk: "medium" },
  { name: "spec", description: "Show the frozen SharedSpec goal", risk: "low" },
  { name: "constitution", description: "Open constitution constraints", risk: "low" },
  { name: "tasks", description: "List planned tasks", risk: "low" },
  { name: "analyze", description: "Run SDD traceability analyze", risk: "low" },
  { name: "constraint", description: "Add a constraint note for the next plan", risk: "medium" },
  { name: "spawn", description: "Spawn a named subagent", risk: "medium" },
  { name: "baby", description: "Run the baby-model harness", risk: "low" },
  { name: "agents", description: "List builtin subagent definitions", risk: "low" },
  { name: "sdd", description: "Run the SDD subagent pipeline", risk: "medium" },
  { name: "deploy", description: "Queue a deploy", risk: "high" },
  { name: "docker", description: "Queue docker build", risk: "high" },
  { name: "env", description: "Show non-secret env keys", risk: "medium" },
  { name: "review", description: "Ask the review subagent to look at a path", risk: "low" },
  { name: "explain", description: "Explain a file or symbol", risk: "low" },
  { name: "summarize", description: "Summarize a path", risk: "low" },
  { name: "ask", description: "Ask a question against project memory", risk: "low" },
  { name: "docs", description: "Search local docs", risk: "low" },
  { name: "remember", description: "Store a memory in AutoMem", risk: "medium" },
  { name: "recall", description: "Recall memories from AutoMem", risk: "low" },
  { name: "graph", description: "Query the Graphiti knowledge graph", risk: "low" },
  { name: "mcp-list", description: "List connected MCP servers and tools", risk: "low" },
  { name: "mcp-call", description: "Call an MCP tool", risk: "high" },
  { name: "hooks", description: "List registered hooks", risk: "low" },
  { name: "rollback", description: "Queue a git reset of the last commit", risk: "high" },
  { name: "open", description: "Open a path in the editor", risk: "low" },
]

export const HOST_COMMANDS = [
  { id: "agent-core.openSidebar", title: "Agent Core: Open Sidebar" },
  { id: "agent-core.acceptDiff", title: "Agent Core: Accept Proposed Change" },
  { id: "agent-core.rejectDiff", title: "Agent Core: Reject Proposed Change" },
  { id: "agent-core.toggleTheme", title: "Agent Core: Toggle Light/Dark Theme" },
  { id: "agent-core.focusComposer", title: "Agent Core: Focus Composer" },
  { id: "agent-core.cancelRun", title: "Agent Core: Cancel Run" },
] as const

export function commandIdForSlash(name: string): string {
  return `agent-core.slash.${name}`
}

export function paletteCommands(): SlashPaletteCommand[] {
  return BUILTIN_SLASH.map((c) => ({
    id: commandIdForSlash(c.name),
    title: `Agent Core: /${c.name}`,
    slash: `/${c.name}`,
    description: c.description,
    risk: c.risk,
  }))
}

export function vscodeCommandContributions(): Array<{ command: string; title: string; category: string }> {
  const host = HOST_COMMANDS.map((c) => ({ command: c.id, title: c.title, category: "Agent Core" }))
  const slashes = paletteCommands().map((c) => ({
    command: c.id,
    title: c.title,
    category: "Agent Core",
  }))
  return [...host, ...slashes]
}

export function parseSlashInvocation(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) return null
  const body = trimmed.slice(1).trim()
  if (!body) return null
  const [name, ...rest] = body.split(/\s+/)
  return { name, args: rest }
}
