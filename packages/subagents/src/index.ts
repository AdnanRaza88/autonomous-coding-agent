import { ensureBuiltinsRegistered } from "./builtins.js"

ensureBuiltinsRegistered()

export type { SubagentDefinition } from "./definitions.js"
export {
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
} from "./definitions.js"

export { runSubagent, runBabySubagent } from "./run.js"
export type { RunSubagentOptions } from "./run.js"

export { buildMessages, buildSystemPrompt, formatSharedSpec } from "./messages.js"
export { getBuiltinDefinitions } from "./builtins.js"

export {
  BABY_CONTEXT_BUDGET,
  estimateTokens,
  fitToBabyBudget,
} from "./budget.js"
export type { BudgetFit } from "./budget.js"

export {
  parseNeedsSubtasks,
  isNeedsSubtasks,
  formatNeedsSubtasks,
} from "./spawn.js"
export type { NeedsSubtasksSignal, SuggestedSubtask } from "./spawn.js"
