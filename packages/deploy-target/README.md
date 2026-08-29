# @agent-core/deploy-target

One-click deploy for projects the agent builds. This package does not host anything. It drives the user's own accounts on existing targets:

- `vercel` — static / frontend projects via the Vercel REST API (`POST /v2/files` then `POST /v13/deployments`, poll until `READY`)
- `fly` — full-stack / container projects via the Fly Machines API (`POST /v1/apps`, `POST /v1/apps/:app/machines`)

Tokens stay on the user's machine. Enter them once with `setTargetCredentials`; they are never logged.

## Public API

```ts
registerDeployTarget(target)
deployProject(runId, targetId?)
registerRun(runId, { projectDir, spec })
setTargetCredentials(targetId, { token, teamId?, org?, projectName? })
onDeployProgress((event) => {})
```

`deployProject` picks a target from `SharedSpec.constraints` (`kind`, `stack`, `deploy`, `host`) and, if those are silent, from files on disk (`Dockerfile`, `package.json` server deps, `index.html`). A second call for the same `runId` reuses the same remote project name.

## Standalone

From the monorepo root:

```
npm install
npm test -w @agent-core/deploy-target
```

Wire a finished orchestrator run:

```
registerRun(run.id, { projectDir: "./out/run", spec: run.spec })
setTargetCredentials("vercel", { token: process.env.VERCEL_TOKEN! })
const { url, status } = await deployProject(run.id)
```

Failure codes: `bad_token`, `missing_token`, `build_error`, `unknown_run`, `unknown_target`, `quota`, `timeout`. The UI should print `error.message` as-is.

## Adding a target

Implement `DeployTarget` (`id`, `kind`, `detect`, `deploy`) and call `registerDeployTarget`. Orchestration code does not change.
