export interface SharedSpec {
  goal: string
  constraints: Record<string, string>
  styleGuide?: Record<string, string>
  createdAt: string
}

export interface AgentTask {
  id: string
  title: string
  instructions: string
  dependsOn: string[]
  assignedModel?: string
  status: "queued" | "running" | "verifying" | "passed" | "failed" | "retrying"
}

export interface AgentResult {
  taskId: string
  output: string
  attempt: number
  passed: boolean
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  calls: number
}

export interface ProviderConfig {
  id: string
  baseUrl: string
  apiKey: string
  model: string
  contextWindow: number
}

export interface ProviderAdapter {
  chat(config: ProviderConfig, messages: ChatMessage[]): Promise<string>
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export type OrchestratorEvent =
  | { type: "planning" }
  | { type: "plan_ready"; tasks: AgentTask[] }
  | { type: "agent_start"; taskId: string }
  | { type: "agent_verify"; taskId: string; attempt: number; pass: boolean; feedback: string }
  | { type: "agent_done"; taskId: string; output: string }
  | { type: "run_complete"; results: AgentResult[] }
  | { type: "run_cancelled"; reason: string }
  | { type: "error"; message: string }
