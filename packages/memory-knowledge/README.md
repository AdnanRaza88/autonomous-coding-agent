# @agent-core/memory-knowledge

Thin integration layer over AutoMem (cross-session memory) and Graphiti (project knowledge graph). This package does not store vectors or graphs itself.

## What it owns

- HTTP clients for AutoMem (`POST /memory`, `GET /recall`, `GET /health`) and Graphiti (`POST /episodes`, `POST /search/facts`, `POST /search/nodes`)
- `getProjectContext(query)` for subagents
- `recordRunComplete` on orchestrator `run_complete`
- `ingestSddDocuments` for constitution / spec / plan (and optional tasks / analyze)
- user fact edits that Graphiti ingests the same way as agent episodes
- compose fragment `docker-compose.memory.yml` for module 06 to include

## Public API

```ts
import {
  getProjectContext,
  createMemoryLayer,
  recordRunComplete,
  ingestSddDocuments,
} from "@agent-core/memory-knowledge"
```

`getProjectContext` talks to the active layer (HTTP by default, local in-memory when `AGENT_CORE_MEMORY_MODE=local` or `NODE_ENV=test`). Wire a layer once at process start:

```ts
import { createMemoryLayer, setMemoryLayer } from "@agent-core/memory-knowledge"

setMemoryLayer(createMemoryLayer())
const ctx = await getProjectContext("what database does this project use")
```

On `run_complete`:

```ts
await layer.recordRunCompleteFromEvent(event, { runId, goal, spec })
```

After an SDD pass:

```ts
await layer.ingestSddDocuments({
  constitution,
  spec,
  plan,
  goal: spec.goal,
})
```

## Config

| Env | Default |
|---|---|
| `AUTOMEM_API_URL` | `http://127.0.0.1:8000` |
| `AUTOMEM_API_TOKEN` | unset |
| `GRAPHITI_API_URL` | `http://127.0.0.1:8001` |
| `GRAPHITI_GROUP_ID` | `agent-core` |
| `AGENT_CORE_MEMORY_MODE` | `http` (`local` for tests / offline) |

A downed service never fails a subagent start. Recall errors become empty lists.

## Run / test

From this package:

```
npx tsx --test src/**/*.test.ts
```

From the monorepo root:

```
npm test -w @agent-core/memory-knowledge
```

HTTP client tests spin a local Node server; they do not need Docker.

## Containers

`docker-compose.memory.yml` is the fragment module 06 should merge. AutoMem stays on host `8000`. Graphiti is published on host `8001` so it matches the MCP default in `@agent-core/mcp-hooks-plugins`. Swap images if you pin a different official tag in deploy.

## Out of scope

Embeddings, FalkorDB, Qdrant, Neo4j internals, and importance decay live in AutoMem / Graphiti. The graph browser UI lives in module 05 and should call `listGraphFacts` / `applyUserFactEdit`.
