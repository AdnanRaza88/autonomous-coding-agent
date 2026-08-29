import type { PermissionRisk } from "./types.js"

export type ArgKind = "path" | "rest" | "cwd" | "first" | "goal" | "json"

export interface CatalogEntry {
  name: string
  description: string
  risk: PermissionRisk
  server?: string
  tool?: string
  action?: string
  map?: Record<string, ArgKind>
}

export const catalog: CatalogEntry[] = [
  { name: "help", description: "List slash commands", risk: "low", action: "help" },
  { name: "commands", description: "Print command names", risk: "low", action: "commands" },
  { name: "cwd", description: "Show working directory", risk: "low", action: "cwd" },
  { name: "read", description: "Read a file through the filesystem MCP server", risk: "low", server: "filesystem", tool: "read_file", map: { path: "first" } },
  { name: "write", description: "Write a file through the filesystem MCP server", risk: "high", server: "filesystem", tool: "write_file", map: { path: "path", content: "rest" } },
  { name: "ls", description: "List a directory", risk: "low", server: "filesystem", tool: "list_directory", map: { path: "first" } },
  { name: "tree", description: "Directory tree", risk: "low", server: "filesystem", tool: "directory_tree", map: { path: "first" } },
  { name: "search", description: "Search file contents", risk: "low", server: "filesystem", tool: "search_files", map: { path: "cwd", pattern: "first" } },
  { name: "mkdir", description: "Create a directory", risk: "medium", server: "filesystem", tool: "create_directory", map: { path: "first" } },
  { name: "rm", description: "Delete a path", risk: "high", server: "filesystem", tool: "delete_file", map: { path: "first" } },
  { name: "mv", description: "Move a file", risk: "medium", server: "filesystem", tool: "move_file", map: { source: "path", destination: "rest" } },
  { name: "cp", description: "Copy by reading then writing", risk: "medium", action: "cp" },
  { name: "cat", description: "Alias for read", risk: "low", server: "filesystem", tool: "read_file", map: { path: "first" } },
  { name: "status", description: "Git status", risk: "low", server: "git", tool: "git_status", map: { repo: "cwd" } },
  { name: "diff", description: "Git diff", risk: "low", server: "git", tool: "git_diff", map: { repo: "cwd", target: "first" } },
  { name: "log", description: "Git log", risk: "low", server: "git", tool: "git_log", map: { repo: "cwd" } },
  { name: "branch", description: "List or create a branch", risk: "medium", server: "git", tool: "git_branch", map: { repo: "cwd", name: "first" } },
  { name: "checkout", description: "Checkout a ref", risk: "high", server: "git", tool: "git_checkout", map: { repo: "cwd", ref: "first" } },
  { name: "commit", description: "Create a commit", risk: "high", server: "git", tool: "git_commit", map: { repo: "cwd", message: "rest" } },
  { name: "stash", description: "Git stash", risk: "medium", server: "git", tool: "git_stash", map: { repo: "cwd", action: "first" } },
  { name: "pull", description: "Git pull", risk: "high", server: "git", tool: "git_pull", map: { repo: "cwd" } },
  { name: "push", description: "Git push", risk: "high", server: "git", tool: "git_push", map: { repo: "cwd" } },
  { name: "blame", description: "Git blame", risk: "low", server: "git", tool: "git_blame", map: { repo: "cwd", path: "first" } },
  { name: "test", description: "Queue workspace tests", risk: "medium", action: "test" },
  { name: "test-file", description: "Queue a single test file", risk: "medium", action: "test-file" },
  { name: "coverage", description: "Queue coverage", risk: "low", action: "coverage" },
  { name: "lint", description: "Queue lint", risk: "low", action: "lint" },
  { name: "typecheck", description: "Queue typecheck", risk: "low", action: "typecheck" },
  { name: "format", description: "Queue formatter", risk: "medium", action: "format" },
  { name: "plan", description: "Ask the orchestrator to plan from the current spec", risk: "medium", action: "plan" },
  { name: "loop", description: "Re-run failed tasks", risk: "medium", action: "loop" },
  { name: "retry", description: "Retry one task", risk: "medium", action: "retry" },
  { name: "cancel", description: "Cancel the current run", risk: "high", action: "cancel" },
  { name: "pause", description: "Pause the current run", risk: "medium", action: "pause" },
  { name: "resume", description: "Resume a paused run", risk: "medium", action: "resume" },
  { name: "run-status", description: "Show orchestrator run status", risk: "low", action: "run-status" },
  { name: "blackboard", description: "Read or write the shared blackboard key", risk: "medium", action: "blackboard" },
  { name: "spec", description: "Show the frozen SharedSpec goal", risk: "low", action: "spec" },
  { name: "constitution", description: "Open constitution constraints", risk: "low", action: "constitution" },
  { name: "tasks", description: "List planned tasks", risk: "low", action: "tasks" },
  { name: "analyze", description: "Run SDD traceability analyze", risk: "low", action: "sdd-analyze" },
  { name: "constraint", description: "Add a constraint note for the next plan", risk: "medium", action: "constraint" },
  { name: "spawn", description: "Spawn a named subagent", risk: "medium", action: "spawn" },
  { name: "baby", description: "Run the baby-model harness", risk: "low", action: "baby" },
  { name: "agents", description: "List builtin subagent definitions", risk: "low", action: "agents" },
  { name: "sdd", description: "Run the SDD subagent pipeline", risk: "medium", action: "sdd" },
  { name: "deploy", description: "Queue a deploy", risk: "high", action: "deploy" },
  { name: "docker", description: "Queue docker build", risk: "high", action: "docker" },
  { name: "env", description: "Show non-secret env keys", risk: "medium", action: "env" },
  { name: "review", description: "Ask the review subagent to look at a path", risk: "low", action: "review" },
  { name: "explain", description: "Explain a file or symbol", risk: "low", action: "explain" },
  { name: "summarize", description: "Summarize a path", risk: "low", action: "summarize" },
  { name: "ask", description: "Ask a question against project memory", risk: "low", server: "graphiti", tool: "search_nodes", map: { query: "rest" } },
  { name: "docs", description: "Search local docs", risk: "low", action: "docs" },
  { name: "remember", description: "Store a memory in AutoMem", risk: "medium", server: "automem", tool: "store_memory", map: { text: "rest" } },
  { name: "recall", description: "Recall memories from AutoMem", risk: "low", server: "automem", tool: "recall_memory", map: { query: "rest" } },
  { name: "graph", description: "Query the Graphiti knowledge graph", risk: "low", server: "graphiti", tool: "search_facts", map: { query: "rest" } },
  { name: "mcp-list", description: "List connected MCP servers and tools", risk: "low", action: "mcp-list" },
  { name: "mcp-call", description: "Call an MCP tool: /mcp-call server tool json-args", risk: "high", action: "mcp-call" },
  { name: "hooks", description: "List registered hooks", risk: "low", action: "hooks" },
  { name: "rollback", description: "Queue a git reset of the last commit", risk: "high", server: "git", tool: "git_reset", map: { repo: "cwd", mode: "first" } },
  { name: "open", description: "Open a path in the IDE shell later", risk: "low", action: "open" },
]
