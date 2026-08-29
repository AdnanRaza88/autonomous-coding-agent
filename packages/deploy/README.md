# @agent-core/deploy

Local Docker packaging and the security boundary for Agent Core.

This package owns three things:

1. A single-container boot path that creates `/data`, a master encryption key, and the persisted store, then serves the built UI on port 3000.
2. AES-256-GCM encryption for provider API keys and MCP credentials so they never land on disk in plaintext.
3. A default-deny execution sandbox: filesystem writes stay inside `/data/workspace`, shell hooks run only if the binary is on an explicit allowlist, and every denial is appended to `/data/audit.log`.

## One-click run

From the monorepo root:

```
docker build -f packages/deploy/Dockerfile -t agent-core .
docker run -p 3000:3000 -v agent-core-data:/data agent-core
```

Or with AutoMem and Graphiti:

```
docker compose -f packages/deploy/docker-compose.yml up --build
```

Open `http://localhost:3000`. Restarting the container keeps runs, subagent definitions, provider rows, and the master key on the `agent-core-data` volume.

## Update

No auto-updater in v1. Pull a newer image and recreate the container. The volume is left untouched.

```
docker pull agent-core:latest
docker rm -f agent-core
docker run --name agent-core -p 3000:3000 -v agent-core-data:/data agent-core
```

## Standalone tests

```
cd packages/deploy
npm test
```

The tests cover key generation, ciphertext that does not contain the plaintext, symlink escape, parent-directory writes, sudo / command-substitution denial, and the HTTP gate.

## Public API

- `bootstrapRuntime` — create data dir, master key, store, audit log, sandbox
- `encryptSecret` / `decryptSecret` / `loadOrCreateMasterKey`
- `openStore` — encrypted secret rows plus provider / subagent / run documents
- `createSandbox` — `resolveInside`, `assertWritable`, `allowCommand`
- `createApp` / `startServer` — Fastify process used by the container entrypoint

HTTP surface:

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/api/secrets` | ids only, never values |
| POST | `/api/secrets` | encrypts `value` at rest |
| POST | `/api/sandbox/write-check` | 403 if the path leaves the workspace |
| POST | `/api/sandbox/command` | 403 if the binary is not allowlisted |
| GET | `/api/audit` | recent denial and allow events |

## Security model

- Master key lives at `/data/.master.key` (32-byte hex) or `AGENT_CORE_MASTER_KEY`. Generated on first boot.
- Secrets are scrypt-stretched then AES-256-GCM sealed. The on-disk store is `/data/agent-core.db`.
- Workspace root is `/data/workspace`. `..`, absolute paths outside that root, and symlinks that resolve outside it are blocked and logged.
- Allowed binaries: git, npm, npx, node, tsx, tsc, python3, common file tools. `sudo`, `chmod`, `docker`, pipes, and `$(...)` are refused.

Wire module 04 `requestPermission` in front of `allowCommand` in the merged server. This package is the second gate: even a granted permission cannot leave the workspace or run a denied binary.
