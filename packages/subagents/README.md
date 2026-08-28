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
  registerSubagentDefinition,
  listSubagentDefinitions,
  getSubagentDefinition,
  type SubagentDefinition,
  type RunSubagentOptions,
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
  run.ts           runSubagent
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
- `runBabySubagent` and self-spawn signaling are not in this package surface yet.
