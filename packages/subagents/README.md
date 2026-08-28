# @agent-core/subagents

Isolated subagent runner and definition registry for Agent Core.

Each `runSubagent` call gets a fresh message history and a read-only copy of the current `SharedSpec` injected as system context. Concurrent calls never share mutable state.

## Install

From the monorepo root:

```bash
npm install
```

## Public API

```typescript
import {
  runSubagent,
  runBabySubagent,
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
  parseNeedsSubtasks,
  isNeedsSubtasks,
  formatNeedsSubtasks,
  BABY_CONTEXT_BUDGET,
  estimateTokens,
  fitToBabyBudget,
  type SubagentDefinition,
  type RunSubagentOptions,
  type NeedsSubtasksSignal,
  type SuggestedSubtask,
} from "@agent-core/subagents"
import type { AgentTask, SharedSpec, ProviderConfig } from "@agent-core/types"
```

### `runSubagent`

```typescript
const result = await runSubagent(task, spec, providerConfig)
// result: { taskId, output, attempt, passed }
```

Optional fourth argument:

```typescript
await runSubagent(task, spec, providerConfig, {
  definitionId: "coder",
  adapter: customAdapter,
  attempt: 2,
})
```

- Builds an isolated `ChatMessage[]` every call (system = persona + full SharedSpec, user = task).
- Uses `getAdapter(providerConfig)` from `@agent-core/providers` unless `adapter` is supplied.
- Does not verify the result; verification belongs to the orchestrator.

### `runBabySubagent`

Small-context harness capped at 100k tokens (`BABY_CONTEXT_BUDGET`). Truncates and prioritizes the shared spec and task instructions before the call so the prompt never exceeds the budget. Reuses `runSubagent` internally.

```typescript
const result = await runBabySubagent(task, spec, providerConfig, options)
```

- Budget is enforced in this package; the model is not trusted to stay under the limit.
- Task id, status, dependsOn, and assignedModel are preserved under truncation.
- Suitable for high-volume fan-out (dozens to hundreds of cheap concurrent calls).

### Self-spawn signal

A subagent may request further decomposition by emitting a structured signal in its output. This package never recursively calls `runSubagent`; it only surfaces the signal for the orchestrator (module 01) to re-plan that branch.

```typescript
type NeedsSubtasksSignal = {
  type: "needs_subtasks"
  reason: string
  suggestedSubtasks: { title: string; instructions: string }[]
}

const signal = parseNeedsSubtasks(result.output)
if (signal) {
  // report to orchestrator; do not spawn here
}
```

Helpers:

- `parseNeedsSubtasks(output)` — returns the signal or `null`
- `isNeedsSubtasks(output)` — boolean check
- `formatNeedsSubtasks(signal)` — stable JSON serialization for tests and fixtures

Accepted shapes: plain JSON, fenced ```json blocks, or JSON embedded in prose. The `type` field must be exactly `"needs_subtasks"`.

### Definitions

```typescript
registerSubagentDefinition({
  id: "security-reviewer",
  name: "Security Reviewer",
  systemPromptTemplate: "You review code for security issues...",
  defaultModel: "llama-3.3-70b-versatile",
  maxContextTokens: 131072,
  tools: [],
})

const all = listSubagentDefinitions()
const one = getSubagentDefinition("coder")
```

Built-in definitions registered on first import: `planner`, `coder`, `reviewer`, `tester`, `researcher`.

Custom definitions registered via `registerSubagentDefinition` are available to the UI and orchestrator without changing this package.

## Concurrent safety

Every invocation allocates its own message array and reads the definition registry by value. Ten parallel `runSubagent` calls with different tasks and the same `SharedSpec` cannot leak messages or task state into each other.

## Layout

```
packages/subagents/src/
  index.ts         public exports + builtin bootstrap
  run.ts           runSubagent, runBabySubagent
  messages.ts      pure message construction from task + spec
  definitions.ts   SubagentDefinition registry
  builtins.ts      planner / coder / reviewer / tester / researcher
  budget.ts        100k context fit for baby harness
  spawn.ts         needs_subtasks signal parse / format
```

## Test

```bash
cd packages/subagents
npm test
```

## Non-goals

- Does not own the task DAG (graph-engine).
- Does not talk to MCP servers (mcp-hooks-plugins).
- Does not recursively spawn subagents; self-spawn is a signal only.
