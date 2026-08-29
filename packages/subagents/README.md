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
  runSddSubagent,
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

### `runSddSubagent`

Spec-driven development pipeline (module 08). Turns a one-line goal into constitution.md, spec.md, plan.md, tasks.md, and a `SharedSpec`. Stages are gated in that order. Ambiguous goals produce an Open questions list instead of a silent default. Implementation lives in `definitions/sdd`.

```typescript
const sdd = await runSddSubagent(userGoal, providerConfig)
// sdd.sharedSpec is consumed by the orchestrator as-is
```

Also importable as `@agent-core/subagents/sdd`.

### Self-spawn signal

A subagent may request further decomposition by emitting a structured signal in its output. This package never recursively calls `runSubagent`; it only surfaces the signal for the orchestrator (module 01) to re-plan that branch.

```typescript
const signal = parseNeedsSubtasks(result.output)
if (signal) {
  // report to orchestrator; do not spawn here
}
```

### Definitions

Built-in definitions registered on first import: `planner`, `coder`, `reviewer`, `tester`, `researcher`, `sdd`.

## Concurrent safety

Every invocation allocates its own message array and reads the definition registry by value. Ten parallel `runSubagent` calls with different tasks and the same `SharedSpec` cannot leak messages or task state into each other.

## Layout

```
packages/subagents/src/                 runner, registry, budget, spawn
packages/subagents/definitions/sdd/     SDD subagent (module 08)
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
