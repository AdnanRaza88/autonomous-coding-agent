# @agent-core/deploy

Docker image, workspace sandbox, encrypted secret store, and the Fastify boot server.

The server hosts the control-plane HTTP contract used by `packages/web`:

- `GET /api/providers` catalog from models.dev builtins
- `GET /api/providers/:id/models`
- `GET /api/providers/saved` and `POST /api/providers` (keys stay encrypted)
- `POST /api/runs`, `GET /api/runs`, `GET /api/runs/:id`
- `POST /api/runs/:id/cancel` cooperative abort
- `GET /api/runs/:id/events` Server-Sent Events of `OrchestratorEvent` frames
- `GET /api/permissions/events` Server-Sent Events of permission prompts
- `GET /api/permissions/rules` and `DELETE /api/permissions/session`
- `GET/POST /api/subagents` persisted and registered live
- `GET /api/commands` and `POST /api/commands/:name` through the slash catalog
- `GET/POST /api/mcp/servers` plus `POST /api/permissions/:id`

Sandbox and secret routes from module 06 remain unchanged.

## Run

```
npm start -w @agent-core/deploy
npm test -w @agent-core/deploy
```

Set `AGENT_CORE_WEB_ROOT` to a built `packages/web/dist` to serve the UI from the same process.
