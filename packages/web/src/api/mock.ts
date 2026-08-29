import type { AgentResult, AgentTask, OrchestratorEvent } from "@agent-core/types"
import { topologicalBatches } from "../lib/dag.js"
import { redactProvider } from "./contract.js"
import type {
  AgentCoreApi,
  McpServerDraft,
  PermissionPrompt,
  PermissionRuleView,
  ProviderModel,
  ProviderSummary,
  RunSnapshot,
  RunSummary,
  SaveProviderRequest,
  SavedProvider,
  SlashCommandInfo,
  StartRunRequest,
  SubagentDraft,
  WsInbound,
} from "./contract.js"

export interface MockBus {
  publish(message: WsInbound): void
  subscribe(fn: (message: WsInbound) => void): () => void
}

export function createMockBus(): MockBus {
  const listeners = new Set<(message: WsInbound) => void>()
  return {
    publish(message) {
      for (const fn of listeners) fn(message)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

const builtinProviders: ProviderSummary[] = [
  { id: "groq", name: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { id: "openai", name: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "openrouter", name: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { id: "ollama", name: "Ollama", defaultBaseUrl: "http://127.0.0.1:11434/v1" },
]

const modelsByProvider: Record<string, ProviderModel[]> = {
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000 },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", contextWindow: 128000 },
  ],
  openai: [{ id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1048576 }],
  openrouter: [{ id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200000 }],
  ollama: [{ id: "qwen2.5-coder:7b", name: "Qwen2.5 Coder 7B", contextWindow: 32768 }],
}

const defaultCommands: SlashCommandInfo[] = [
  { name: "help", description: "List slash commands", risk: "low" },
  { name: "spec", description: "Show the frozen SharedSpec", risk: "low" },
  { name: "plan", description: "Show the current task DAG", risk: "low" },
  { name: "mcp-list", description: "List connected MCP servers", risk: "low" },
  { name: "read", description: "Read a file via filesystem MCP", risk: "medium" },
]

export function createMockApi(bus: MockBus): AgentCoreApi {
  const saved = new Map<string, SavedProvider>()
  const keys = new Map<string, string>()
  const subagents = new Map<string, SubagentDraft>([
    [
      "implementer",
      {
        id: "implementer",
        name: "Implementer",
        systemPromptTemplate: "Implement the assigned task. Stay inside the spec.",
        defaultModel: "llama-3.3-70b-versatile",
        maxContextTokens: 32000,
        tools: ["read", "write", "edit"],
      },
    ],
  ])
  const servers = new Map<string, McpServerDraft>()
  servers.set("filesystem", {
    id: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    connected: true,
  })
  const runs = new Map<string, RunSnapshot>()
  const summaries = new Map<string, RunSummary>()
  const aborted = new Set<string>()
  const prompts = new Map<string, PermissionPrompt>()
  const rules = new Map<string, PermissionRuleView>()
  let seq = 0

  return {
    async listProviders() {
      return builtinProviders
    },
    async listProviderModels(providerId) {
      return modelsByProvider[providerId] ?? []
    },
    async listSavedProviders() {
      return [...saved.values()]
    },
    async saveProvider(body: SaveProviderRequest) {
      if (body.apiKey) keys.set(body.id, body.apiKey)
      const record = redactProvider({
        id: body.id,
        baseUrl: body.baseUrl,
        apiKey: body.apiKey,
        model: body.model,
        contextWindow: body.contextWindow,
      })
      saved.set(body.id, record)
      return record
    },
    async startRun(body: StartRunRequest) {
      const runId = `run_${++seq}`
      const tasks = planFromGoal(body.goal)
      const snapshot: RunSnapshot = {
        runId,
        status: "planning",
        goal: body.goal,
        tasks,
        results: [],
        events: [{ type: "planning" }],
      }
      runs.set(runId, snapshot)
      summaries.set(runId, {
        id: runId,
        goal: body.goal,
        status: "planning",
        createdAt: new Date().toISOString(),
      })
      queueMicrotask(() => simulateRun(runId, tasks, runs, summaries, aborted, bus))
      return { runId }
    },
    async getRun(runId) {
      const snap = runs.get(runId)
      if (!snap) throw new Error(`unknown run ${runId}`)
      return structuredClone(snap)
    },
    async listRuns() {
      return [...summaries.values()].reverse()
    },
    async cancelRun(runId) {
      const snap = runs.get(runId)
      if (!snap) throw new Error(`unknown run ${runId}`)
      if (snap.status === "complete" || snap.status === "error" || snap.status === "cancelled") {
        return { runId, cancelled: false, status: snap.status }
      }
      aborted.add(runId)
      const event: OrchestratorEvent = { type: "run_cancelled", reason: "cancelled" }
      snap.events.push(event)
      applyEvent(snap, event)
      const summary = summaries.get(runId)
      if (summary) summary.status = "cancelled"
      bus.publish({ channel: "orchestrator", runId, event })
      return { runId, cancelled: true, status: "cancelled" }
    },
    async listSubagents() {
      return [...subagents.values()]
    },
    async upsertSubagent(body) {
      subagents.set(body.id, { ...body, tools: [...body.tools] })
      return subagents.get(body.id)!
    },
    async deleteSubagent(id) {
      subagents.delete(id)
    },
    async listCommands() {
      return defaultCommands
    },
    async runCommand(name, args) {
      return { output: `/${name} ${args.join(" ")}`.trim() }
    },
    async listMcpServers() {
      return [...servers.values()]
    },
    async connectMcpServer(body) {
      const next = { ...body, connected: true }
      servers.set(body.id, next)
      return next
    },
    async listPermissions() {
      return { pending: [...prompts.values()] }
    },
    async decidePermission(id, decision) {
      const prompt = prompts.get(id)
      prompts.delete(id)
      if (!prompt) return
      if (decision === "allow_always") {
        rules.set(`rule_${id}`, {
          id: `rule_${id}`,
          effect: "allow",
          scope: "exact",
          persist: "always",
          kind: prompt.kind,
          serverId: prompt.serverId,
          toolName: prompt.toolName,
          command: prompt.command,
          action: prompt.action,
        })
      }
      if (decision === "allow_session" || decision === "allow_server" || decision === "deny_session") {
        rules.set(`rule_${id}`, {
          id: `rule_${id}`,
          effect: decision === "deny_session" ? "deny" : "allow",
          scope: decision === "allow_server" ? "server" : "exact",
          persist: "session",
          kind: prompt.kind,
          serverId: prompt.serverId,
          toolName: decision === "allow_server" ? undefined : prompt.toolName,
          command: prompt.command,
          action: prompt.action,
        })
      }
    },
    async listPermissionRules() {
      return [...rules.values()]
    },
    async removePermissionRule(id) {
      rules.delete(id)
    },
    async clearPermissionSession() {
      for (const [id, rule] of rules) {
        if (rule.persist === "session") rules.delete(id)
      }
    },
  }
}

function planFromGoal(goal: string): AgentTask[] {
  const base = goal.trim() || "untitled"
  return [
    task("t1", "Write spec", `Turn into a SharedSpec: ${base}`, []),
    task("t2", "Plan work", "Break the spec into tasks", ["t1"]),
    task("t3", "Implement core", "Implement the primary path", ["t2"]),
    task("t4", "Write tests", "Cover the core path", ["t2"]),
    task("t5", "Verify", "Run tests and summarize", ["t3", "t4"]),
  ]
}

function task(id: string, title: string, instructions: string, dependsOn: string[]): AgentTask {
  return { id, title, instructions, dependsOn, status: "queued" }
}

async function simulateRun(
  runId: string,
  tasks: AgentTask[],
  runs: Map<string, RunSnapshot>,
  summaries: Map<string, RunSummary>,
  aborted: Set<string>,
  bus: MockBus,
): Promise<void> {
  const emit = (event: OrchestratorEvent) => {
    const snap = runs.get(runId)
    if (!snap || snap.status === "cancelled") return
    snap.events.push(event)
    applyEvent(snap, event)
    const summary = summaries.get(runId)
    if (summary) summary.status = snap.status
    bus.publish({ channel: "orchestrator", runId, event })
  }

  emit({ type: "plan_ready", tasks: structuredClone(tasks) })
  const batches = topologicalBatches(tasks)
  const results: AgentResult[] = []

  for (const batch of batches) {
    if (aborted.has(runId)) return
    await Promise.all(
      batch.map(async (node) => {
        if (aborted.has(runId)) return
        emit({ type: "agent_start", taskId: node.id })
        await wait(40)
        if (aborted.has(runId)) return
        emit({
          type: "agent_verify",
          taskId: node.id,
          attempt: 1,
          pass: true,
          feedback: "checks passed",
        })
        const output = `${node.title} complete`
        emit({ type: "agent_done", taskId: node.id, output })
        results.push({ taskId: node.id, output, attempt: 1, passed: true })
      }),
    )
  }

  if (aborted.has(runId)) return
  emit({ type: "run_complete", results })
}

export function applyEvent(snap: RunSnapshot, event: OrchestratorEvent): void {
  if (event.type === "planning") {
    snap.status = "planning"
    return
  }
  if (event.type === "plan_ready") {
    snap.status = "running"
    snap.tasks = event.tasks.map((t) => ({ ...t }))
    return
  }
  if (event.type === "agent_start") {
    patchTask(snap, event.taskId, "running")
    return
  }
  if (event.type === "agent_verify") {
    patchTask(snap, event.taskId, event.pass ? "verifying" : "retrying")
    return
  }
  if (event.type === "agent_done") {
    patchTask(snap, event.taskId, "passed")
    return
  }
  if (event.type === "run_complete") {
    snap.status = "complete"
    snap.results = event.results
    return
  }
  if (event.type === "run_cancelled") {
    snap.status = "cancelled"
    snap.error = event.reason
    return
  }
  snap.status = "error"
  snap.error = event.message
}

function patchTask(snap: RunSnapshot, taskId: string, status: AgentTask["status"]): void {
  snap.tasks = snap.tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function samplePermission(id = "perm_1"): PermissionPrompt {
  return {
    id,
    kind: "mcp_tool",
    action: "filesystem.write_file",
    risk: "high",
    serverId: "filesystem",
    toolName: "write_file",
    detail: "packages/web/README.md",
  }
}
