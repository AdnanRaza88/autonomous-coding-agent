# Agent Core

Local-first coding agent platform. TypeScript monorepo.

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
| `packages/deploy` | Docker image, sandbox, secret store |
| `apps/ide` | Code-OSS sidebar host |
| `tests` | Cross-package integration suite |

## Run

```
npm install
npm test
npm run test:integration
```

Docker image lives in `packages/deploy`.
