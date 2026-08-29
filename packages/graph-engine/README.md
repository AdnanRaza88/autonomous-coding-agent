# @agent-core/graph-engine

Orchestrator for Agent Core. Turns a user goal into a frozen `SharedSpec`, a DAG of `AgentTask`s, then runs workers through module 02 with a verify/retry loop.

Workers never talk to each other. Coordination lives here.

## Public API

```ts
createRun(userGoal, providerConfig, options?): Promise<string>
getRunEvents(runId): AsyncIterable<OrchestratorEvent>
getRunState(runId): { spec, tasks, results }
```

`createRun` finishes spec generation and planning before it returns the run id. Execution continues in the background. Subscribe with `getRunEvents` (buffered from the first event) or poll `getRunState`.

## Flow

1. Spec generator calls the provider layer and freezes the resulting `SharedSpec`. Every later worker receives that same object.
2. Planner asks the model for a bounded DAG (cap 12). Broken JSON or a cyclic graph falls back to a small heuristic plan.
3. Executor batches ready tasks (`Promise.all` inside a batch, batches in order). Fan-out is capped per batch.
4. After each worker returns, a verifier scores the output against the spec and the original instructions only — not the production transcript. Failures retry with feedback appended, default 3 attempts.
5. A failed task blocks its dependents; they are marked failed and skipped.

## Events

`planning` → `plan_ready` → `agent_start` → `agent_verify` (each attempt) → `agent_done` → `run_complete`. Failures also emit `error`.

## Standalone test

From the monorepo root, with workspaces installed:

```
npm test -w @agent-core/graph-engine
```

Tests inject a fake `chat` / `runTask` / `verify` so they do not hit a network.

## Options (tests and later modules)

`adapter`, `chat`, `runTask`, `verify`, `maxRetries`, `maxBatch`. Production callers can omit all of them; the engine uses `@agent-core/providers` and `runSubagent` from `@agent-core/subagents`.
