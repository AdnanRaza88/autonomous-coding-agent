import { extractOpenQuestions, parseTasksMarkdown } from "./parse.js"

export type TraceGap = {
  kind: "task_missing_trace" | "plan_missing_spec" | "constitution_violation" | "dangling_dependency"
  message: string
}

export type AnalyzeReport = {
  ready: boolean
  gaps: TraceGap[]
  openQuestions: ReturnType<typeof extractOpenQuestions>
  summary: string
}

const DECISION = /\bD\d+\b/g

export function analyzeDocuments(input: {
  constitution: string
  spec: string
  plan: string
  tasks: string
}): AnalyzeReport {
  const gaps: TraceGap[] = []
  const planDecisions = collect(input.plan, DECISION)
  const planText = input.plan
  const tasks = parseTasksMarkdown(input.tasks)
  const taskIds = new Set(tasks.map((t) => t.id))

  if (planDecisions.size === 0 && input.plan.trim()) {
    gaps.push({
      kind: "plan_missing_spec",
      message: "plan.md has no numbered decisions (D1, D2, ...)",
    })
  }

  for (const d of planDecisions) {
    const cited = planCitesRequirement(planText, d)
    if (!cited) {
      gaps.push({
        kind: "plan_missing_spec",
        message: `decision ${d} does not cite a spec requirement`,
      })
    }
  }

  for (const task of tasks) {
    const blob = `${task.title}\n${task.instructions}`
    const traces = blob.match(/\bD\d+\b/g) ?? []
    if (traces.length === 0) {
      gaps.push({
        kind: "task_missing_trace",
        message: `task ${task.id} has no tracesTo plan decision`,
      })
    }
    for (const dep of task.dependsOn) {
      if (!taskIds.has(dep)) {
        gaps.push({
          kind: "dangling_dependency",
          message: `task ${task.id} depends on missing ${dep}`,
        })
      }
    }
  }

  const styleHits = detectConstitutionClash(input.constitution, input.plan)
  gaps.push(...styleHits)

  const openQuestions = [
    ...extractOpenQuestions(input.spec, "spec"),
    ...extractOpenQuestions(input.plan, "plan"),
  ]

  const blocking = gaps.length > 0 || openQuestions.length > 0
  const summary = blocking
    ? `${gaps.length} gap(s), ${openQuestions.length} open question(s)`
    : "traceability complete"
  return {
    ready: !blocking,
    gaps,
    openQuestions,
    summary,
  }
}

function collect(text: string, re: RegExp): Set<string> {
  const out = new Set<string>()
  const copy = new RegExp(re.source, re.flags)
  let m: RegExpExecArray | null
  while ((m = copy.exec(text)) !== null) out.add(m[0])
  return out
}

function planCitesRequirement(plan: string, decision: string): boolean {
  const idx = plan.indexOf(decision)
  if (idx < 0) return false
  const window = plan.slice(Math.max(0, idx - 80), idx + 240)
  return /\bR\d+\b/.test(window) || /spec|requirement/i.test(window)
}

function detectConstitutionClash(constitution: string, plan: string): TraceGap[] {
  const gaps: TraceGap[] = []
  const noComments = /no comments/i.test(constitution)
  if (noComments && /jsdoc|inline comments required/i.test(plan)) {
    gaps.push({
      kind: "constitution_violation",
      message: "plan requires comments while constitution forbids them",
    })
  }
  return gaps
}
