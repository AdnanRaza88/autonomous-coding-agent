# Agent Core

Local-first coding agent platform. TypeScript monorepo.

All numbered modules (00-12) are on `main`. Current work is product hardening: the Fastify boot server now implements the web control-plane contract against the real packages instead of the UI mock.

## Packages

| Package | Role |
|---|---|
| `shared/types` | Shared contracts |
| `packages/providers` | models.dev registry + OpenAI-compatible adapters |
| `packages/subagents` | Isolated subagent runner, builtins, SDD |
| `packages/graph-engine` | Planner, DAG executor, verify/retry |
| `packages/mcp-hooks-plugins` | MCP client, permission gate, hooks, slash commands |
| `packages/memory-knowledge` | AutoMem + Graphiti |
| `packages/vault-knowledge-base` | Obsidian-compatible vault |
| `packages/web` | Vite + React control surface |
| `packages/deploy-target` | One-click Vercel / Fly deploy |
| `packages/deploy` | Docker image, sandbox, secret store, control-plane HTTP |
| `apps/ide` | Code-OSS sidebar host |
| `tests` | Cross-package integration suite |

## Run

```
npm install
npm test
npm run test:integration
npm start -w @agent-core/deploy
```

Docker image lives in `packages/deploy`.
