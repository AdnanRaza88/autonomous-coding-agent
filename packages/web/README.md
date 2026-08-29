# @agent-core/web

Browser UI for Agent Core. Vite + React + Tailwind. Talks to the backend over REST and Server-Sent Events.

Production builds (`npm run build`) use `createHttpApi` against same-origin `/api`. `npm run dev` keeps the in-package mock so the UI can be exercised without the boot server. `npm run dev:live` proxies `/api` to `AGENT_CORE_API` (default `http://127.0.0.1:3000`).

Live runs hydrate from `GET /api/runs/:id` then subscribe to `GET /api/runs/:id/events`. The EventSource reconnects with exponential backoff and `?after=<last index>` so a dropped connection does not replay work already folded into the DAG. `run_complete`, `run_cancelled`, and `error` close the stream. Run history comes from `GET /api/runs`. The last run id is kept in `sessionStorage` so a reload resumes the same snapshot.

## Screens

- Run: goal composer, provider/model pickers, live DAG tree grouped by `topologicalBatches`, cancel while planning or running
- History: sidebar list of persisted runs; click to hydrate
- Subagents: create/edit/delete definitions; the next `startRun` sees the new list without a reload
- Connections: provider credentials (key sent once, never re-read) and MCP server attach
- Permission modal: once / session / server session / always / deny session / deny once
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

## REST contract the UI expects

| Method | Path | Notes |
|---|---|---|
| GET | `/api/providers` | builtin catalog |
| GET | `/api/providers/:id/models` | |
| GET | `/api/providers/saved` | keys omitted; `hasKey` only |
| POST | `/api/providers` | body includes `apiKey` once |
| POST | `/api/runs` | `{ goal, providerId, model }` |
| GET | `/api/runs` | persisted history |
| GET | `/api/runs/:id` | snapshot + events + optional goal |
| POST | `/api/runs/:id/cancel` | cooperative abort |
| GET | `/api/runs/:id/events` | SSE `orchestrator` frames; `after` or `Last-Event-ID` |
| GET/POST | `/api/subagents` | |
| DELETE | `/api/subagents/:id` | |
| GET | `/api/commands` | |
| POST | `/api/commands/:name` | `{ args }` |
| GET/POST | `/api/mcp/servers` | |
| GET | `/api/permissions` | queued prompts |
| GET | `/api/permissions/events` | SSE `permission` frames |
| GET | `/api/permissions/rules` | session and always grants |
| DELETE | `/api/permissions/session` | drop session grants |
| POST | `/api/permissions/:id` | `{ decision }` |

Module 06 owns encrypted persistence of the key after the first POST.
