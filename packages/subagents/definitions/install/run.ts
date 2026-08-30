import type { ProviderConfig } from "@agent-core/types"
import { runSubagent } from "../../src/run.js"
import { installDefinition } from "./definition.js"
import type { AgentTask, SharedSpec } from "@agent-core/types"

export async function runInstallAgent(
  goal: string,
  providerConfig: ProviderConfig,
  spec?: SharedSpec
): Promise<{ status: string; report: string }> {
  const task: AgentTask = {
    id: "install-setup",
    title: "System install and health",
    instructions: goal,
    dependsOn: [],
    status: "queued",
  }

  const shared: SharedSpec = spec ?? {
    goal: "Make Agent Core fully operational with search, memory, and domain tools",
    constraints: {
      style: "zero-user-friction",
      install: "hermes-style-self-setup",
    },
    createdAt: new Date().toISOString(),
  }

  const result = await runSubagent(task, shared, providerConfig, {
    definitionId: installDefinition.id,
  })

  return {
    status: result.output.toLowerCase().includes("blocked") ? "blocked" : "ready",
    report: result.output,
  }
}
