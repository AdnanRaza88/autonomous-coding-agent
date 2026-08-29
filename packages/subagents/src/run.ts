import type {
  AgentResult,
  AgentTask,
  ProviderAdapter,
  ProviderConfig,
  SharedSpec,
} from "@agent-core/types"
import { getAdapter, streamChat } from "@agent-core/providers"
import { getSubagentDefinition } from "./definitions.js"
import { buildMessages } from "./messages.js"
import { ensureBuiltinsRegistered } from "./builtins.js"
import { BABY_CONTEXT_BUDGET, fitToBabyBudget } from "./budget.js"

export type RunSubagentOptions = {
  definitionId?: string
  adapter?: ProviderAdapter
  attempt?: number
  onDelta?: (text: string) => void
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
  const onDelta = options?.onDelta

  let output: string
  if (onDelta && !options?.adapter) {
    const pieces: string[] = []
    for await (const piece of streamChat(providerConfig, messages)) {
      if (!piece) continue
      pieces.push(piece)
      onDelta(piece)
    }
    output = pieces.join("")
  } else {
    output = await adapter.chat(providerConfig, messages)
    if (onDelta && output) onDelta(output)
  }

  return {
    taskId: task.id,
    output,
    attempt,
    passed: true,
  }
}

export async function runBabySubagent(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: RunSubagentOptions
): Promise<AgentResult> {
  const fitted = fitToBabyBudget(task, spec, BABY_CONTEXT_BUDGET)
  return runSubagent(fitted.task, fitted.spec, providerConfig, options)
}
