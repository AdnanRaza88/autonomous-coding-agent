import { ensureBuiltinsRegistered } from "./builtins.js"

ensureBuiltinsRegistered()

export type { SubagentDefinition } from "./definitions.js"
export {
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
} from "./definitions.js"

export { runSubagent } from "./run.js"
export type { RunSubagentOptions } from "./run.js"

export { buildMessages, buildSystemPrompt, formatSharedSpec } from "./messages.js"
export { getBuiltinDefinitions } from "./builtins.js"
