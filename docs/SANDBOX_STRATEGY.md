# Sandbox Strategy

## Goals

- Isolate all agent-generated code execution from the host and from other sessions.
- Provide a realistic development environment with language runtimes, package managers, and git.
- Enforce resource and network limits that prevent runaway cost or security incidents.
- Support fast allocation and teardown so that latency does not dominate end-to-end runtime.

## Architecture

A central Sandbox Manager maintains a pool of warm containers and creates cold containers on demand.

Each agent session receives exactly one sandbox. The sandbox is destroyed at the end of the session or after a configurable idle timeout.

```
[Sandbox Manager]
       |
       +-- warm pool (pre-pulled images, pre-cloned base repos optional)
       |
       +-- session map: session_id -> container_id + metadata
```

## Base Images

Supported base images (extensible):

- python:3.12-slim-bookworm + git + common build tools
- node:20-bookworm-slim + git
- golang:1.22-bookworm
- multi-language image containing Python, Node, and Go for mixed repositories

Each image is rebuilt weekly and scanned for vulnerabilities.

## Lifecycle

1. Allocation
   - Prefer a warm container of the correct language family.
   - If none available, create a new container from the base image.
   - Mount a session-specific volume for the workspace.
   - Clone the target repository into the workspace (shallow clone by default).
   - Inject environment variables and secrets according to the repository policy.

2. Runtime
   - All tool calls that mutate state or execute code are proxied into the container via the Docker API or a lightweight agent process inside the container.
   - Working directory is fixed to the repository root.
   - stdout and stderr are captured and returned to the orchestrator.

3. Snapshot (optional)
   - After successful test runs the manager may create a filesystem snapshot for later inspection or resume.
   - Snapshots are stored in object storage with a short retention period.

4. Teardown
   - On session completion or abort the container is stopped and removed.
   - Volumes are deleted unless retention is requested for debugging.
   - Network rules and any temporary credentials are revoked.

## Resource Limits

Default limits (configurable per repository):

| Resource       | Limit          |
|----------------|----------------|
| CPU            | 2 cores        |
| Memory         | 4 GiB          |
| Disk (ephemeral) | 10 GiB       |
| Wall-clock     | 30 minutes     |
| Process count  | 256            |

Hard kill is performed if wall-clock or memory limits are exceeded.

## Network Policy

Default deny all egress.

Allow-list (configurable):

- github.com (HTTPS)
- api.github.com
- registry.npmjs.org
- pypi.org / files.pythonhosted.org
- proxy.golang.org / sum.golang.org
- Additional domains declared in repository settings

DNS resolution is restricted to the allow-listed domains.

Inbound connections are never accepted.

## Secrets Handling

- Secrets are injected only as environment variables or as files with mode 0600.
- Secrets never appear in tool logs or control-panel event streams.
- Temporary credentials (short-lived GitHub tokens) are preferred over long-lived PATs.
- The sandbox cannot access the host Docker socket or any other container.

## Security Hardening

- Containers run as a non-root user.
- Seccomp and AppArmor profiles are applied.
- Capabilities are dropped to the minimum set required for package installation and git operations.
- No privileged mode.
- Read-only root filesystem where possible; only the workspace volume is writable.

## Observability

The manager emits:

- allocation latency
- container start failures
- resource usage samples (CPU, memory, network)
- teardown events

These metrics feed the evaluation and cost dashboards.

## Failure Handling

- If allocation fails after three retries the session is escalated.
- If a container becomes unresponsive the manager force-kills it and marks the iteration failed.
- Orphaned containers older than the maximum session age are reaped by a background job.
