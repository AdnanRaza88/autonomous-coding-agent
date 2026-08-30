# Install Agent

Hermes-style self-setup agent for Agent Core.

- Detects and installs Node, Python (uv), project deps, Agent-Reach, Pinch Memory adapters, MCP servers.
- Runs doctor checks.
- User never runs install commands manually.
- Called by the orchestrator on first boot or when a capability is missing.

## Usage

```ts
import { runInstallAgent } from "@agent-core/subagents/install"

const { status, report } = await runInstallAgent(
  "Ensure Agent-Reach search and Pinch Memory are available",
  providerConfig
)
```
