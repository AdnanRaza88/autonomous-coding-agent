import type {
  AgentResult,
  AgentTask,
  ProviderAdapter,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import { getAdapter } from "@agent-core/providers"
import { getSubagentDefinition } from "./definitions.js"
import { buildMessages } from "./messages.js"
import { ensureBuiltinsRegistered } from "./builtins.js"

export type RunSubagentOptions = {
  definitionId?: string
  adapter?: ProviderAdapter
  attempt?: number
}

export async function runSubagent(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: RunSubagentOptions
): Promise<AgentResult> {
  ensureBuiltinsRegistered()

  const definition = options?.definitionId
    ? getSubagentDefinition(options.definitionId)
    : undefined

  const messages = buildMessages(task, spec, definition)
  const adapter = options?.adapter ?? getAdapter(providerConfig)
  const attempt = options?.attempt ?? 1

  const output = await adapter.chat(providerConfig, messages)

  return {
    taskId: task.id,
    output,
    attempt,
    passed: true,
  }
}
