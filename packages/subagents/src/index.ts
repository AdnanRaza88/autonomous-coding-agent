import { ensureBuiltinsRegistered } from "./builtins.js"

ensureBuiltinsRegistered()

export type { SubagentDefinition } from "./definitions.js"
export {
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
} from "./definitions.js"

export {
  runSubagent,
  runSubagentDetailed,
  runBabySubagent,
  runBabySubagentDetailed,
} from "./run.js"
export type { RunSubagentOptions, SubagentRun } from "./run.js"

export { buildMessages, buildSystemPrompt, formatSharedSpec } from "./messages.js"
export { getBuiltinDefinitions } from "./builtins.js"

export {
  BABY_MAX_CONTEXT_TOKENS,
  BABY_OUTPUT_RESERVE_TOKENS,
  estimateTokens,
  estimateMessageTokens,
  fitToTokenBudget,
} from "./budget.js"
export type { BudgetFit } from "./budget.js"

export { parseSpawnSignal, spawnSystemHint } from "./spawn.js"
export type { SpawnRequest, ProposedSubtask } from "./spawn.js"
