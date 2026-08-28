import type {
  AgentResult,
  AgentTask,
  ChatMessage,
  ProviderAdapter,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import { getAdapter } from "@agent-core/providers"
import { runSubagent } from "@agent-core/subagents"
import type { VerifyVerdict } from "./verify.js"

export type TaskRunner = (
  task: AgentTask,
  spec: SharedSpec,
  config: ProviderConfig,
  attempt: number,
  definitionId?: string
) => Promise<AgentResult>

export type Verifier = (
  task: AgentTask,
  spec: SharedSpec,
  output: string,
  config: ProviderConfig
) => Promise<VerifyVerdict>

export type CreateRunOptions = {
  adapter?: ProviderAdapter
  chat?: (config: ProviderConfig, messages: ChatMessage[]) => Promise<string>
  runTask?: TaskRunner
  verify?: Verifier
  maxRetries?: number
  maxBatch?: number
}

export function resolveChat(
  config: ProviderConfig,
  options?: CreateRunOptions
): (config: ProviderConfig, messages: ChatMessage[]) => Promise<string> {
  if (options?.chat) return options.chat
  const adapter = options?.adapter ?? getAdapter(config)
  return (cfg, messages) => adapter.chat(cfg, messages)
}

export function resolveRunner(options?: CreateRunOptions): TaskRunner {
  if (options?.runTask) return options.runTask
  return async (task, spec, config, attempt, definitionId) => {
    return runSubagent(task, spec, config, {
      adapter: options?.adapter,
      attempt,
      definitionId,
    })
  }
}
