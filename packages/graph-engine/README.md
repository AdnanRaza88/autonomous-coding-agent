# @agent-core/graph-engine

Orchestrator for Agent Core. Turns a user goal into a frozen `SharedSpec`, a DAG of `AgentTask`s, then runs workers through module 02 with a verify/retry loop.

Workers never talk to each other. Coordination lives here.

## Public API

```ts
createRun(userGoal, providerConfig, options?): Promise<string>
cancelRun(runId, reason?): boolean
getRunEvents(runId, after?): AsyncIterable<OrchestratorEvent>
getRunState(runId): { spec, tasks, results, status, usage }
listRuns(): Array<{ id, status, createdAt, goal?, usage? }>
```

`createRun` finishes spec generation and planning before it returns the run id. Execution continues in the background. Subscribe with `getRunEvents` (buffered from the first event, or from `after + 1` on reconnect) or poll `getRunState`.

`cancelRun` marks the run aborted. The executor checks between batches and attempts, then emits `run_cancelled` and stops. Already-started workers finish their current call; queued work is dropped.

## Flow

1. Spec generator calls the provider layer and freezes the resulting `SharedSpec`. Every later worker receives that same object.
2. Planner asks the model for a bounded DAG (cap 12). Broken JSON or a cyclic graph falls back to a small heuristic plan.
3. Executor batches ready tasks (`Promise.all` inside a batch, batches in order). Fan-out is capped per batch.
4. After each worker returns, a verifier scores the output against the spec and the original instructions only — not the production transcript. Failures retry with feedback appended, default 3 attempts.
5. A failed task blocks its dependents; they are marked failed and skipped.
6. `cancelRun` is cooperative. Status becomes `cancelled` instead of `complete`.

## Events

`planning` → `usage` (after each metered provider call) → `plan_ready` → `agent_start` → `agent_delta` (worker draft) → `agent_verify` (each attempt) → `agent_done` → `run_complete`. Failures emit `error`. An abort emits `run_cancelled`. `usage` frames carry cumulative input/output/call totals for the run. `agent_delta` carries worker text as it arrives. OpenAI-compatible providers stream token chunks through `streamChat`; other providers and injected adapters emit one frame with the full reply. A snapshot frame with the complete output is also published before verify.

Event indexes are zero-based and stable for the life of the run. Pass the last received index as `after` to skip frames already applied on the client.

## Standalone test

From the monorepo root, with workspaces installed:

```
npm test -w @agent-core/graph-engine
```

Tests inject a fake `chat` / `runTask` / `verify` so they do not hit a network.

## Options (tests and later modules)

`adapter`, `chat`, `runTask`, `verify`, `maxRetries`, `maxBatch`, `onDelta`. Production callers can omit all of them; the engine uses `@agent-core/providers` and `runSubagent` from `@agent-core/subagents`.
