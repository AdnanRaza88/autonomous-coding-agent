import type { AgentTask } from "@agent-core/types"

export type DagIssue =
  | { kind: "missing_dep"; taskId: string; dep: string }
  | { kind: "cycle"; nodes: string[] }
  | { kind: "duplicate_id"; taskId: string }

export function validateDag(tasks: AgentTask[]): DagIssue[] {
  const issues: DagIssue[] = []
  const ids = new Set<string>()
  for (const task of tasks) {
    if (ids.has(task.id)) issues.push({ kind: "duplicate_id", taskId: task.id })
    ids.add(task.id)
  }
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) issues.push({ kind: "missing_dep", taskId: task.id, dep })
    }
  }
  const cycle = findCycle(tasks)
  if (cycle) issues.push({ kind: "cycle", nodes: cycle })
  return issues
}

export function repairDag(tasks: AgentTask[]): AgentTask[] {
  const ids = new Set(tasks.map((t) => t.id))
  const seen = new Set<string>()
  const out: AgentTask[] = []
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    out.push({
      ...task,
      dependsOn: task.dependsOn.filter((d) => ids.has(d) && d !== task.id),
    })
  }
  const cycle = findCycle(out)
  if (!cycle) return out
  return out.map((t) => {
    if (!cycle.includes(t.id)) return t
    return {
      ...t,
      dependsOn: t.dependsOn.filter((d) => !cycle.includes(d)),
    }
  })
}

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
      const leftover = [...remaining.values()]
      leftover.sort((a, b) => a.id.localeCompare(b.id))
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

export function dependentsOf(tasks: AgentTask[], taskId: string): string[] {
  return tasks.filter((t) => t.dependsOn.includes(taskId)).map((t) => t.id)
}

function findCycle(tasks: AgentTask[]): string[] | null {
  const adj = new Map<string, string[]>()
  for (const t of tasks) adj.set(t.id, [...t.dependsOn])
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  const visit = (id: string): string[] | null => {
    if (visited.has(id)) return null
    if (visiting.has(id)) {
      const idx = stack.indexOf(id)
      return idx >= 0 ? stack.slice(idx).concat(id) : [id]
    }
    visiting.add(id)
    stack.push(id)
    for (const next of adj.get(id) ?? []) {
      if (!adj.has(next)) continue
      const hit = visit(next)
      if (hit) return hit
    }
    stack.pop()
    visiting.delete(id)
    visited.add(id)
    return null
  }

  for (const t of tasks) {
    const hit = visit(t.id)
    if (hit) return hit
  }
  return null
}
