# @agent-core/subagents

Isolated subagent runner and definition registry for Agent Core.

Each `runSubagent` call gets a fresh message history and a read-only copy of the current `SharedSpec` injected as system context. Concurrent calls never share mutable state. This package does not own the task DAG and does not invoke child agents; when a model asks for decomposition it only returns a `needs_subtasks` signal for the orchestrator.

## Install

From the monorepo root:

```bash
npm install
```

## Public API

```typescript
import {
  runSubagent,
  runSubagentDetailed,
  runBabySubagent,
  runBabySubagentDetailed,
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
  parseSpawnSignal,
  BABY_MAX_CONTEXT_TOKENS,
  type SubagentDefinition,
  type RunSubagentOptions,
  type SubagentRun,
  type SpawnRequest,
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

- Builds an isolated `ChatMessage[]` every call (system = persona + SharedSpec + spawn hint, user = task).
- Uses `getAdapter(providerConfig)` from `@agent-core/providers` unless `adapter` is supplied.
- Does not verify the result; verification belongs to the orchestrator.
- Does not recurse when the model requests subtasks.

`runSubagentDetailed` returns the same result plus `spawn`, `tokensSent`, and `truncated`.

### `runBabySubagent`

High-volume fan-out path. Same contract as `runSubagent`, but the outgoing prompt is fitted to a hard 100k-token budget before the provider is called. Spec fields and task instructions are truncated in a fixed order (style guide, then constraints, then goal, then instructions). The cap is enforced here; it is not left to the model.

```typescript
const result = await runBabySubagent(task, hugeSpec, providerConfig, {
  definitionId: "researcher",
  adapter,
})
```

### Definitions

```typescript
registerSubagentDefinition({
  id: "security-reviewer",
  name: "Security Reviewer",
  systemPromptTemplate: "You review code for security issues.",
  defaultModel: "llama-3.3-70b-versatile",
  maxContextTokens: 131072,
  tools: [],
})

const all = listSubagentDefinitions()
const one = getSubagentDefinition("coder")
```

Built-in definitions registered on first import: `planner`, `coder`, `reviewer`, `tester`, `researcher`.

### Self-spawn signal

If the model cannot finish the unit of work it may emit:

```json
{
  "needs_subtasks": true,
  "reason": "the change spans three packages",
  "subtasks": [
    { "title": "Update types", "instructions": "..." }
  ]
}
```

`parseSpawnSignal(output, taskId)` turns that into a `SpawnRequest`. The runner never calls itself with those proposed tasks. Module 01 re-plans the branch.

On a spawn signal, `AgentResult.passed` is `false` so the orchestrator can distinguish a finished unit from a decomposition request. The raw model text stays in `output`.

## Concurrent safety

Every invocation allocates its own message array and reads the definition registry by value. Ten parallel `runSubagent` calls with different tasks and the same `SharedSpec` cannot leak messages or task state into each other.

## Layout

```
packages/subagents/src/
  index.ts         public exports + builtin bootstrap
  run.ts           runSubagent / runBabySubagent
  budget.ts        token estimate and 100k fit
  spawn.ts         needs_subtasks parser
  messages.ts      pure message construction from task + spec
  definitions.ts   SubagentDefinition registry
  builtins.ts      planner / coder / reviewer / tester / researcher
```

## Test

```bash
cd packages/subagents
npm test
```

## Non-goals

- Does not own the task DAG (graph-engine).
- Does not talk to MCP servers (mcp-hooks-plugins).
