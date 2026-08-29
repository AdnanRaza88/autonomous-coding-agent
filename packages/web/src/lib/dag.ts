import type { AgentTask } from "@agent-core/types"

export function topologicalBatches(tasks: AgentTask[]): AgentTask[][] {
  const remaining = new Map(tasks.map((t) => [t.id, { ...t, dependsOn: [...t.dependsOn] }]))
  const done = new Set<string>()
  const batches: AgentTask[][] = []
  const original = new Map(tasks.map((t) => [t.id, t]))

  while (remaining.size > 0) {
    const ready: AgentTask[] = []
    for (const task of remaining.values()) {
      const unmet = task.dependsOn.filter((d) => !done.has(d) && remaining.has(d))
      if (unmet.length === 0) ready.push(original.get(task.id) ?? task)
    }
    if (ready.length === 0) {
      const leftover = [...remaining.values()].sort((a, b) => a.id.localeCompare(b.id))
      const forced = original.get(leftover[0].id) ?? leftover[0]
      batches.push([forced])
      done.add(forced.id)
      remaining.delete(forced.id)
      continue
    }
    ready.sort((a, b) => a.id.localeCompare(b.id))
    batches.push(ready)
    for (const t of ready) {
      done.add(t.id)
      remaining.delete(t.id)
    }
  }
  return batches
}
