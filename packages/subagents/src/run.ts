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
import {
  BABY_MAX_CONTEXT_TOKENS,
  BABY_OUTPUT_RESERVE_TOKENS,
  estimateMessageTokens,
  fitToTokenBudget,
} from "./budget.js"
import { parseSpawnSignal, spawnSystemHint, type SpawnRequest } from "./spawn.js"

export type RunSubagentOptions = {
  definitionId?: string
  adapter?: ProviderAdapter
  attempt?: number
  maxContextTokens?: number
  reserveTokens?: number
}

export type SubagentRun = AgentResult & {
  spawn: SpawnRequest | null
  tokensSent: number
  truncated: boolean
}

function resolveAdapter(
  providerConfig: ProviderConfig,
  options?: RunSubagentOptions
): ProviderAdapter {
  return options?.adapter ?? getAdapter(providerConfig)
}

function toResult(run: SubagentRun): AgentResult {
  return {
    taskId: run.taskId,
    output: run.output,
    attempt: run.attempt,
    passed: run.passed,
  }
}

export async function runSubagentDetailed(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: RunSubagentOptions
): Promise<SubagentRun> {
  ensureBuiltinsRegistered()

  const definition = options?.definitionId
    ? getSubagentDefinition(options.definitionId)
    : undefined

  const cap = options?.maxContextTokens
  let messages = buildMessages(task, spec, definition)
  let truncated = false

  if (cap !== undefined) {
    const fitted = fitToTokenBudget(
      task,
      spec,
      definition,
      cap,
      options?.reserveTokens ?? BABY_OUTPUT_RESERVE_TOKENS
    )
    messages = fitted.messages
    truncated = fitted.truncated
  }

  if (messages[0]?.role === "system") {
    messages = [
      { role: "system", content: `${messages[0].content}\n\n${spawnSystemHint()}` },
      ...messages.slice(1),
    ]
  }

  if (cap !== undefined) {
    const fittedAgain = fitToTokenBudget(
      { ...task, instructions: messages[1]?.content ?? task.instructions },
      spec,
      {
        id: definition?.id ?? "ephemeral",
        name: definition?.name ?? "ephemeral",
        systemPromptTemplate: messages[0]?.content ?? "",
        defaultModel: definition?.defaultModel ?? providerConfig.model,
        maxContextTokens: cap,
        tools: definition?.tools ?? [],
      },
      cap,
      options?.reserveTokens ?? BABY_OUTPUT_RESERVE_TOKENS
    )
    messages = fittedAgain.messages
    truncated = truncated || fittedAgain.truncated
  }

  const adapter = resolveAdapter(providerConfig, options)
  const attempt = options?.attempt ?? 1
  const output = await adapter.chat(providerConfig, messages)
  const spawn = parseSpawnSignal(output, task.id)

  return {
    taskId: task.id,
    output,
    attempt,
    passed: spawn === null,
    spawn,
    tokensSent: estimateMessageTokens(messages),
    truncated,
  }
}

export async function runSubagent(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: RunSubagentOptions
): Promise<AgentResult> {
  const run = await runSubagentDetailed(task, spec, providerConfig, options)
  return toResult(run)
}

export async function runBabySubagent(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: Omit<RunSubagentOptions, "maxContextTokens">
): Promise<AgentResult> {
  const run = await runSubagentDetailed(task, spec, providerConfig, {
    ...options,
    maxContextTokens: BABY_MAX_CONTEXT_TOKENS,
    reserveTokens: options?.reserveTokens ?? BABY_OUTPUT_RESERVE_TOKENS,
  })
  return toResult(run)
}

export async function runBabySubagentDetailed(
  task: AgentTask,
  spec: SharedSpec,
  providerConfig: ProviderConfig,
  options?: Omit<RunSubagentOptions, "maxContextTokens">
): Promise<SubagentRun> {
  return runSubagentDetailed(task, spec, providerConfig, {
    ...options,
    maxContextTokens: BABY_MAX_CONTEXT_TOKENS,
    reserveTokens: options?.reserveTokens ?? BABY_OUTPUT_RESERVE_TOKENS,
  })
}
