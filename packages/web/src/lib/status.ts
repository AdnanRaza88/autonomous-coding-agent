import type { AgentTask } from "@agent-core/types"

export function statusTone(status: AgentTask["status"]): "queued" | "live" | "ok" | "bad" | "warn" {
  if (status === "passed") return "ok"
  if (status === "failed") return "bad"
  if (status === "retrying") return "warn"
  if (status === "running" || status === "verifying") return "live"
  return "queued"
}

export function statusLabel(status: AgentTask["status"]): string {
  return status
}
