import type { AgentResult, OrchestratorEvent } from "@agent-core/types"
import type { AutoMemClient, RunCompleteRecord } from "./types.js"

export function isRunCompleteEvent(event: OrchestratorEvent): event is Extract<OrchestratorEvent, { type: "run_complete" }> {
  return event.type === "run_complete"
}

export function summarizeRun(record: RunCompleteRecord): string {
  const passed = record.results.filter((r) => r.passed).length
  const failed = record.results.length - passed
  const lines: string[] = []
  if (record.asked) lines.push(`Asked: ${record.asked}`)
  else if (record.goal) lines.push(`Asked: ${record.goal}`)
  else if (record.spec?.goal) lines.push(`Asked: ${record.spec.goal}`)
  if (record.decided) lines.push(`Decided: ${record.decided}`)
  else if (record.spec) lines.push(`Decided: ${formatConstraints(record.spec.constraints)}`)
  lines.push(`Outcome: ${record.outcome ?? `${passed} passed, ${failed} failed of ${record.results.length} tasks`}`)
  if (record.runId) lines.push(`Run: ${record.runId}`)
  const notable = notableResults(record.results)
  if (notable) lines.push(notable)
  return lines.join("\n")
}

export async function recordRunComplete(
  client: AutoMemClient,
  record: RunCompleteRecord,
): Promise<{ id: string }> {
  const content = summarizeRun(record)
  return client.store({
    content,
    type: "Decision",
    tags: ["run", "episode", record.runId ? `run_${record.runId}` : "run_unknown"].filter(Boolean),
    importance: record.results.every((r) => r.passed) ? 0.75 : 0.85,
    metadata: {
      runId: record.runId ?? null,
      taskCount: record.results.length,
      passed: record.results.filter((r) => r.passed).length,
    },
  })
}

export async function recordRunCompleteFromEvent(
  client: AutoMemClient,
  event: OrchestratorEvent,
  extra?: Omit<RunCompleteRecord, "results">,
): Promise<{ id: string } | null> {
  if (!isRunCompleteEvent(event)) return null
  return recordRunComplete(client, { ...extra, results: event.results })
}

function formatConstraints(constraints: Record<string, string>): string {
  const entries = Object.entries(constraints)
  if (entries.length === 0) return "no extra constraints recorded"
  return entries.map(([k, v]) => `${k}=${v}`).join("; ")
}

function notableResults(results: AgentResult[]): string {
  const failed = results.filter((r) => !r.passed).slice(0, 4)
  if (failed.length === 0) return ""
  return `Failed tasks: ${failed.map((r) => `${r.taskId} (attempt ${r.attempt})`).join(", ")}`
}
