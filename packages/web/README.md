# @agent-core/web

Browser UI for Agent Core. Vite + React + Tailwind. Talks to the backend over REST and WebSocket only.

## Screens

- Run: goal composer, provider/model pickers, live DAG tree grouped by `topologicalBatches`
- Subagents: create/edit/delete definitions; the next `startRun` sees the new list without a reload
- Connections: provider credentials (key sent once, never re-read) and MCP server attach
- Permission modal: allow / allow session / deny
- Slash palette: type `/` in the composer

## Theme

Light is default. The toggle writes `agent-core.theme` in `localStorage` and reapplies CSS variables generated from hue 250. Glass treatment is limited to the sidebar, composer shell, palette, and permission overlay. Reading surfaces stay solid.

## Standalone

```bash
cd packages/web
npm install
npm test
npm run dev
```

`npm run dev` boots the UI against the in-package mock API (`createMockApi`). Set `VITE_API_MODE=live` to point at a real backend through the Vite `/api` proxy (`AGENT_CORE_API`, default `http://127.0.0.1:8787`).

## REST contract the UI expects

| Method | Path | Notes |
|---|---|---|
| GET | `/api/providers` | builtin catalog |
| GET | `/api/providers/:id/models` | |
| GET | `/api/providers/saved` | keys omitted; `hasKey` only |
| POST | `/api/providers` | body includes `apiKey` once |
| POST | `/api/runs` | `{ goal, providerId, model }` |
| GET | `/api/runs/:id` | snapshot + events |
| WS | `/api/runs/:id/events` | `OrchestratorEvent` frames |
| GET/POST | `/api/subagents` | |
| DELETE | `/api/subagents/:id` | |
| GET | `/api/commands` | |
| POST | `/api/commands/:name` | `{ args }` |
| GET/POST | `/api/mcp/servers` | |
| POST | `/api/permissions/:id` | `{ decision }` |
| WS | permission frames on the same event socket | `{ channel: "permission", prompt }` |

Module 06 owns encrypted persistence of the key after the first POST.
