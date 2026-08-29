import { ensureBuiltinsRegistered } from "./builtins.js"
import { ensureSddRegistered } from "../definitions/sdd/run.js"

ensureBuiltinsRegistered()
ensureSddRegistered()

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

export {
  runSddSubagent,
  ensureSddRegistered,
  getSddDefinition,
  SDD_DEFINITION_ID,
  extractSharedSpec,
  extractOpenQuestions,
  parseTasksMarkdown,
  analyzeDocuments,
} from "../definitions/sdd/index.js"
export type {
  SddResult,
  RunSddOptions,
  OpenQuestion,
  AnalyzeReport,
} from "../definitions/sdd/index.js"
