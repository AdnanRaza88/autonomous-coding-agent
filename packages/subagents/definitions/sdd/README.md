# SDD subagent

Spec-driven development subagent for Agent Core. Lives at `packages/subagents/definitions/sdd` and registers into the module 02 definition registry as `sdd`.

Given a one-line goal it produces four gated documents and a `SharedSpec` the orchestrator can consume without transformation.

## Documents (in order)

1. `constitution.md` — principles. Testing, style, architecture, done. No features.
2. `spec.md` — what and why. Stories, requirements, non-goals. No libraries or APIs.
3. `plan.md` — how. Decisions D1..Dn each citing a spec requirement, plus a `shared-spec` JSON fence.
4. `tasks.md` — work units t1..tn. Each task cites a plan decision and is executable in isolation.

An analyze pass then checks that tasks trace to plan decisions and plan decisions trace to spec requirements.

## Public API

```typescript
import { runSddSubagent } from "@agent-core/subagents"

const result = await runSddSubagent(userGoal, providerConfig)
// result.constitution
// result.spec
// result.plan
// result.tasks
// result.sharedSpec   SharedSpec from /shared/types
// result.analysis     traceability report
// result.questions    clarifying questions when the goal is underspecified
```

Optional third argument: `{ adapter, now }` for tests.

Stages never skip. Ambiguous goals force an Open questions section in spec.md instead of a silent default.

## Test

```bash
cd packages/subagents
npx tsx --test definitions/sdd/*.test.ts
```

Uses a scripted `ProviderAdapter`. No network.

## Non-goals

- Does not execute tasks or own the DAG (graph-engine).
- Does not persist the vault (module 09 / 12). Callers store constitution.md and spec.md there.
