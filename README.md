# Agent Core

Local-first coding agent platform. TypeScript monorepo.

Agent Core runs parallel specialized subagents against a shared project specification, streams live progress and task drafts over Server-Sent Events, gates MCP tool use behind a permission model, and ships as a single Docker image with an optional Code-OSS sidebar host.

All numbered modules (00-12) are on main. The boot server implements the full web control-plane contract. Production UI builds talk to that HTTP API; npm run dev in the web package still uses the in-package mock bus for isolated frontend work.

## Architecture

| Layer | Package | Role |
|---|---|---|
| Shared contracts | shared/types | SharedSpec, AgentTask, provider and event types |
| Providers | packages/providers | models.dev registry, OpenAI-compatible adapters, streaming, retries |
| Subagents | packages/subagents | Isolated runners, five builtins, baby budget, SDD subagent |
| Graph engine | packages/graph-engine | Planner, DAG batch executor, verify/retry, in-memory blackboard |
| MCP / hooks | packages/mcp-hooks-plugins | MCP client, permission gate, hooks, 62 slash commands |
| Memory | packages/memory-knowledge | AutoMem + Graphiti HTTP clients, local fallback |
| Vault | packages/vault-knowledge-base | Obsidian-compatible Markdown vault with wiki-links |
| Control surface | packages/web | Vite + React + Tailwind, live DAG, permission modal, settings |
| Deploy targets | packages/deploy-target | One-click Vercel static and Fly container adapters |
| Runtime | packages/deploy | Fastify control plane, sandbox, AES-256-GCM secrets, Docker |
| IDE host | apps/ide | Code-OSS sidebar integration (additive; Code-OSS not vendored) |
| Integration | tests | Cross-package suite |

Subagents receive a read-only copy of the current SharedSpec and never share mutable message history. The orchestrator executes ready DAG batches, verifies results, and retries failed tasks under a fixed policy.

## Prerequisites

- Node.js 20 or newer (22 recommended)
- npm 10+
- Docker (optional, for full memory stack and production image)
- API keys for at least one OpenAI-compatible provider (Groq, OpenAI, OpenRouter, Ollama, etc.)

## Install

git clone https://github.com/AdnanRaza88/autonomous-coding-agent.git
cd autonomous-coding-agent
npm install

## Run

### Control plane only

npm start -w @agent-core/deploy

Listens on http://127.0.0.1:3000. Serves the control-plane HTTP API and, when AGENT_CORE_WEB_ROOT points at a built web dist, the production UI.

### Web UI (development)

npm run dev -w @agent-core/web

Uses the in-package mock API and event bus.

### Full stack with memory services

docker compose -f packages/memory-knowledge/docker-compose.memory.yml up -d
AGENT_CORE_MEMORY_MODE=http npm start -w @agent-core/deploy

Environment variables for the memory layer:

| Variable | Default |
|---|---|
| AUTOMEM_API_URL | http://127.0.0.1:8000 |
| AUTOMEM_API_TOKEN | unset |
| GRAPHITI_API_URL | http://127.0.0.1:8001 |
| GRAPHITI_GROUP_ID | agent-core |
| AGENT_CORE_MEMORY_MODE | local (set http to use AutoMem + Graphiti) |

A downed memory service never blocks a run; recall falls back to empty context.

### Docker image

docker build -t agent-core -f packages/deploy/Dockerfile .
docker run --rm -p 3000:3000 -e OPENAI_API_KEY=... -v "$(pwd)/workspace:/workspace" agent-core

Secrets are encrypted at rest with AES-256-GCM. The master key is bootstrapped on first start.

## Test

npm test
npm run test:integration

Package-scoped:

npm test -w @agent-core/subagents
npm test -w @agent-core/graph-engine
npm test -w @agent-core/deploy

## Subagents

Five builtins ship registered:

| Id | Role |
|---|---|
| planner | Breaks a goal into a dependency-aware task DAG |
| coder | Implements a single task to production quality |
| reviewer | Pass/fail review against the shared spec |
| tester | Designs deterministic tests and edge-case coverage |
| researcher | Produces a concise, source-grounded brief |

Plus the Spec-Driven Development subagent (sdd) that produces constitution, spec, plan, tasks and an analyze report with open-question and traceability checks.

Each runSubagent call receives a fresh history and a frozen SharedSpec. Concurrent calls do not share mutable state. Baby subagents are budget-capped via fitToBabyBudget.

## Control-plane HTTP surface

| Method | Path | Purpose |
|---|---|---|
| GET | /api/providers | Catalog |
| GET | /api/providers/:id/models | Models for a provider |
| GET/POST | /api/providers/saved | Persisted provider configs (keys redacted on read) |
| POST | /api/runs | Create a run |
| GET | /api/runs | Run history |
| GET | /api/runs/:id | Run snapshot |
| POST | /api/runs/:id/cancel | Cooperative cancel |
| GET | /api/runs/:id/events | SSE of orchestrator events (Last-Event-ID / ?after supported) |
| GET | /api/permissions/events | SSE of permission prompts |
| GET/DELETE | /api/permissions/rules | Session and always-grant rules |
| POST | /api/permissions/:id | Resolve a prompt |
| GET/POST | /api/subagents | Registered and persisted definitions |
| GET | /api/commands | Slash command catalog |
| POST | /api/commands/:name | Execute a slash command |
| GET/POST | /api/mcp/servers | MCP server configs |
| GET | /api/memory/health | AutoMem + Graphiti health |
| GET | /api/memory/context | Project recall for a query |
| GET/POST | /api/memory/facts | List or add graph facts |
| GET/POST | /api/vault/notes | Obsidian vault notes |
| GET | /api/vault/graph | Wiki-link graph |
| GET | /api/deploy/targets | Registered deploy adapters |
| GET | /api/deploy/detect | Project kind from a run |
| POST | /api/deploy | Deploy a bound run workspace |

## IDE shell

apps/ide provides an additive host for Code-OSS: loopback SPA proxy, diff accept/reject bridge, slash palette (62 commands), status bar projector, and light/dark themes. Code-OSS itself is not vendored.

## Development notes

- Node 20+ required. Workspaces are declared in the root package.json.
- No comments in source. Code is expected to read as senior human-written TypeScript.
- Shared types are the only cross-package contracts.
- Permission always-grants persist to permissions.json via the file-backed store.
- Live event streams support reconnect via SSE id and Last-Event-ID / ?after.
- Memory, vault, and deploy adapters are wired on the boot server. Completed runs are recorded into memory when the layer is available.

## License

See repository for license terms.
