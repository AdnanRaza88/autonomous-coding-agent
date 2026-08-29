# @agent-core/ide

Additive Code-OSS / VS Code shell for Agent Core. This package does not vendor Microsoft's editor. It is the layer you drop next to an upstream Code-OSS checkout: a loopback SPA proxy, a backend process manager, command-palette wiring for the slash catalog, a native diff accept/reject bridge, a status-bar projector, and one light/dark theme pair.

The integration matches the pattern used by production agent IDEs (OpenCode's Code-OSS embed): the module 05 web UI is served from `127.0.0.1` under a stable workspace-keyed path, and the workbench sidebar loads that origin in an iframe. Reloading the window does not tear down the backend, so the current run survives.

## Layout

```
apps/ide
  src/                 runtime (manager, proxy, diff, status, contributions)
  extension/           contribution points + themes consumed by a Code-OSS fork
```

Nothing here patches `src/vs/editor`, the extension host, or LSP. Upstream pulls stay additive.

## Public API

- `createIdeHost(opts)` — spawn backend, bind proxy, return sidebar iframe URL
- `AgentServeManager` — child-process lifecycle, health probe, port recovery, loopback-only
- `startSpaProxy` — serve `packages/web` dist and reverse-proxy `/api` to the backend
- `DiffBridge` — two-buffer proposal that a host opens with the stock diff editor; `accept` / `reject`
- `foldEvent` / `statusFromTasks` — status-bar copy (`Planning`, `Running N parallel`, `Verifying`, `Done`)
- `paletteCommands` / `extensionManifest` — Ctrl+Shift+P entries for 50+ slash commands plus host actions

## Run tests

From the repo root after `npm install`:

```
npm test -w @agent-core/ide
```

Or inside this folder:

```
npx tsx --test src/**/*.test.ts
```

## Wire into a Code-OSS fork

1. Keep Code-OSS as a sibling checkout. Do not copy it into this repo.
2. Build `packages/web` so `packages/web/dist/index.html` exists, or set `AGENT_CORE_WEB_ROOT`.
3. On workbench startup call `createIdeHost({ workspace })`.
4. Point the `agentCore.sidebar` webview HTML at `host.html` (already an iframe to the loopback origin).
5. When a subagent emits a file proposal, call `host.diffs.propose(...)` and open `vscode.diff` with the returned URIs. `agent-core.acceptDiff` writes the proposed buffer onto the workspace file; `agent-core.rejectDiff` drops it.
6. Subscribe orchestrator events to `foldEvent` and write `statusBarText` onto a status-bar item.
7. Register `extensionManifest().contributes.commands` so `/plan`, `/commit`, and the rest are reachable from the stock command palette.

Default ports: backend `3000`, proxy `17300`. Both bind `127.0.0.1`. Occupied ports walk forward. `NO_PROXY` always includes loopback so a system HTTP proxy cannot hairpin the sidecar.
