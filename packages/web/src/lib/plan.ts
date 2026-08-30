import type { AgentTask } from "@agent-core/types"
import { topologicalBatches } from "./dag"
import type { RunView } from "../state/events"

export type PlanProgress = {
  total: number
  passed: number
  failed: number
  live: AgentTask[]
  queued: number
  batches: AgentTask[][]
  activeBatch: number
  line: string
}

const LIVE: AgentTask["status"][] = ["running", "verifying", "retrying"]

export function planProgress(view: RunView): PlanProgress {
  const batches = topologicalBatches(view.tasks)
  const live = view.tasks.filter((t) => LIVE.includes(t.status))
  const passed = view.tasks.filter((t) => t.status === "passed").length
  const failed = view.tasks.filter((t) => t.status === "failed").length
  const queued = view.tasks.filter((t) => t.status === "queued").length
  const activeBatch = batches.findIndex((batch) => batch.some((t) => LIVE.includes(t.status)))
  return {
    total: view.tasks.length,
    passed,
    failed,
    live,
    queued,
    batches,
    activeBatch,
    line: progressLine(view.phase, view.tasks.length, passed, failed, live, queued, activeBatch, batches),
  }
}

function progressLine(
  phase: RunView["phase"],
  total: number,
  passed: number,
  failed: number,
  live: AgentTask[],
  queued: number,
  activeBatch: number,
  batches: AgentTask[][],
): string {
  if (phase === "planning" && total === 0) return "Planning the work."
  if (!total) return ""
  const bits: string[] = [`${passed} of ${total} passed`]
  if (failed) bits.push(`${failed} failed`)
  if (live.length) {
    const batch = activeBatch >= 0 ? activeBatch + 1 : batches.length
    const parallel = activeBatch >= 0 && batches[activeBatch].length > 1 ? " · parallel" : ""
    bits.push(`${live.length} live in batch ${batch}${parallel}`)
  } else if (queued && phase === "running") {
    bits.push(`${queued} queued`)
  }
  return bits.join(" · ")
}
