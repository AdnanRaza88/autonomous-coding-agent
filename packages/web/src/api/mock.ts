import type { AgentResult, AgentTask, OrchestratorEvent } from "@agent-core/types"
import { topologicalBatches } from "../lib/dag.js"
import { redactProvider } from "./contract.js"
import type {
  AgentCoreApi,
  DeployBindingView,
  DeployTargetView,
  GraphFactView,
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
  VaultNoteView,
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
  const facts = new Map<string, GraphFactView>()
  const notes = new Map<string, VaultNoteView>([
    [
      "home",
      {
        id: "home",
        title: "Home",
        path: "Home.md",
        kind: "index",
        links: [],
        body: "Workspace vault index.",
        properties: { kind: "index" },
        mtimeMs: Date.now(),
      },
    ],
  ])
  const targets: DeployTargetView[] = [
    { id: "vercel", kind: "static" },
    { id: "fly", kind: "container" },
  ]
  const creds = new Set<string>()
  const bindings = new Map<string, DeployBindingView>()
  let seq = 0
  let factSeq = 0

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
      else keys.delete(body.id)
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
    async probeProvider(id) {
      const key = keys.get(id)
      if (!key && id !== "ollama") {
        return { ok: false, latencyMs: 0, code: "missing_key", message: "no stored key" }
      }
      if (key === "fail") {
        return { ok: false, latencyMs: 2, code: "auth", message: "rejected" }
      }
      return { ok: true, latencyMs: 3 }
    },
    async startRun(body: StartRunRequest) {
      if (body.providerId !== "ollama" && !keys.get(body.providerId)) {
        throw new Error(`no stored key for ${body.providerId}`)
      }
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
      const prompt = prompts.get(id) ?? {
        id,
        kind: "mcp_tool",
        action: id,
        risk: "high",
      }
      prompts.delete(id)
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
    async memoryHealth() {
      return { automem: "ok", graphiti: "ok" }
    },
    async memoryContext(query) {
      const q = query.toLowerCase()
      const matched = [...facts.values()].filter((f) => f.text.toLowerCase().includes(q))
      return {
        relevantMemories: matched.map((f) => f.text),
        relevantKnowledgeGraphFacts: matched.map((f) => f.text),
      }
    },
    async listFacts(query) {
      const q = (query ?? "").toLowerCase()
      return [...facts.values()].filter((f) => !q || f.text.toLowerCase().includes(q))
    },
    async addFact(body) {
      const id = `fact_${++factSeq}`
      const fact: GraphFactView = {
        id,
        text: body.statement,
        kind: "edit",
        source: body.note,
        createdAt: new Date().toISOString(),
      }
      if (body.replaces) facts.delete(body.replaces)
      facts.set(id, fact)
      return fact
    },
    async listVaultNotes() {
      return [...notes.values()].map(({ body: _body, properties: _p, ...rest }) => rest)
    },
    async readVaultNote(id) {
      const note = notes.get(id)
      if (!note) throw new Error(`unknown note ${id}`)
      return { ...note }
    },
    async writeVaultNote(body) {
      const id = (body.id ?? body.title).trim()
      const note: VaultNoteView = {
        id,
        title: body.title,
        path: `${body.title}.md`,
        kind: body.properties?.kind ?? "entity",
        links: body.links ?? [],
        body: body.body,
        properties: body.properties ?? {},
        mtimeMs: Date.now(),
      }
      notes.set(id, note)
      return note
    },
    async vaultGraph() {
      const nodes = [...notes.values()].map((n) => ({ id: n.id, title: n.title, kind: n.kind, path: n.path }))
      const edges = [...notes.values()].flatMap((n) =>
        n.links.map((to) => ({
          from: n.id,
          to: to.toLowerCase(),
        })),
      )
      return { nodes, edges }
    },
    async vaultBacklinks(id) {
      const key = id.toLowerCase()
      return [...notes.values()]
        .filter((n) => n.links.some((l) => l.toLowerCase() === key || l.toLowerCase() === notes.get(id)?.title.toLowerCase()))
        .map((n) => ({ id: n.id, title: n.title }))
    },
    async listDeployTargets() {
      return targets
    },
    async listDeployBindings() {
      return [...bindings.values()]
    },
    async detectDeploy(runId) {
      const snap = runs.get(runId)
      if (!snap) throw new Error("runId is required and must exist")
      const goal = (snap.goal ?? "").toLowerCase()
      const kind = /docker|container|fly/.test(goal) ? "container" : "static"
      bindings.set(runId, {
        runId,
        projectDir: "/workspace",
        targetId: kind === "static" ? "vercel" : "fly",
      })
      return {
        kind,
        framework: kind === "static" ? "static" : undefined,
        reasons: [kind === "static" ? "no Dockerfile" : "container hint in goal"],
      }
    },
    async saveDeployCredentials(body) {
      if (!body.token) throw new Error("targetId and token are required")
      creds.add(body.targetId)
      return { targetId: body.targetId, hasToken: true }
    },
    async deployRun(body) {
      const snap = runs.get(body.runId)
      if (!snap) throw new Error("runId is required and must exist")
      const targetId = body.targetId ?? "vercel"
      if (body.token) creds.add(targetId)
      if (!creds.has(targetId)) throw new Error("missing credentials")
      const url = `https://${body.runId}.${targetId === "fly" ? "fly.dev" : "vercel.app"}`
      bindings.set(body.runId, {
        runId: body.runId,
        projectDir: "/workspace",
        targetId,
        lastUrl: url,
      })
      return { runId: body.runId, url, status: "live", targetId }
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
    if (summary) {
      summary.status = snap.status
      summary.inputTokens = snap.inputTokens
      summary.outputTokens = snap.outputTokens
      summary.calls = snap.calls
    }
    bus.publish({ channel: "orchestrator", runId, event })
  }

  emit({ type: "plan_ready", tasks: structuredClone(tasks) })
  const batches = topologicalBatches(tasks)
  const results: AgentResult[] = []
  let calls = 0
  let inputTokens = 0
  let outputTokens = 0

  for (const batch of batches) {
    if (aborted.has(runId)) return
    await Promise.all(
      batch.map(async (node) => {
        if (aborted.has(runId)) return
        emit({ type: "agent_start", taskId: node.id })
        const output = `${node.title} complete`
        for (const piece of splitDraft(output)) {
          if (aborted.has(runId)) return
          emit({ type: "agent_delta", taskId: node.id, text: piece })
          await wait(18)
        }
        if (aborted.has(runId)) return
        calls += 1
        inputTokens += 80
        outputTokens += 40
        emit({ type: "usage", inputTokens, outputTokens, calls })
        emit({
          type: "agent_verify",
          taskId: node.id,
          attempt: 1,
          pass: true,
          feedback: "checks passed",
        })
        emit({ type: "agent_done", taskId: node.id, output })
        results.push({ taskId: node.id, output, attempt: 1, passed: true })
      }),
    )
  }

  if (aborted.has(runId)) return
  emit({ type: "run_complete", results })
}

function splitDraft(text: string): string[] {
  const parts = text.match(/\S+\s*/g)
  return parts && parts.length ? parts : [text]
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
  if (event.type === "agent_delta") {
    return
  }
  if (event.type === "usage") {
    snap.inputTokens = event.inputTokens
    snap.outputTokens = event.outputTokens
    snap.calls = event.calls
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
