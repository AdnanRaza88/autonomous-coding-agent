import type { AgentTask, ChatMessage, ProviderConfig, SharedSpec } from "@agent-core/types"
import { asString, extractJson, isRecord } from "./json.js"
import { normalizeTaskId } from "./ids.js"
import { repairDag, validateDag } from "./dag.js"

export type PlannedGraph = {
  tasks: AgentTask[]
  roles: Map<string, string>
}

const MAX_TASKS = 12
const KNOWN_ROLES = new Set(["planner", "coder", "reviewer", "tester", "researcher", "sdd"])

const SYSTEM = `You are the planner for an orchestrator-worker coding agent.
Given a SharedSpec, return JSON only:
{
  "tasks": [
    {
      "id": "t1",
      "title": "short title",
      "instructions": "self-contained objective, expected output format, and explicit boundaries (what NOT to touch)",
      "dependsOn": [],
      "role": "coder"
    }
  ]
}
Rules:
- Workers never talk to each other. Each task must be self-contained.
- Only create parallel tasks when they are truly independent. Tightly coupled work stays sequential.
- Prefer 2-8 tasks. Never more than 12.
- Fan-out costs ~15x tokens. Do not default to maximum parallelism.
- ids must be unique. dependsOn must reference existing ids.
- role is one of: planner, coder, reviewer, tester, researcher, sdd.
- Do not write implementation code.`

export async function planTasks(
  spec: SharedSpec,
  config: ProviderConfig,
  chat: (config: ProviderConfig, messages: ChatMessage[]) => Promise<string>
): Promise<PlannedGraph> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: formatSpecForPlanner(spec) },
  ]
  let raw: string
  try {
    raw = await chat(config, messages)
  } catch {
    return heuristicPlan(spec)
  }
  const parsed = fromModel(raw)
  if (!parsed || parsed.tasks.length === 0) return heuristicPlan(spec)
  const repaired = repairDag(parsed.tasks)
  const issues = validateDag(repaired)
  if (issues.some((i) => i.kind === "cycle")) return heuristicPlan(spec)
  return { tasks: repaired, roles: parsed.roles }
}

export function heuristicPlan(spec: SharedSpec): PlannedGraph {
  const goal = spec.goal
  const needsResearch = /\b(compare|research|evaluate|survey|choose between)\b/i.test(goal)
  const needsTests = spec.constraints.tests === "required" || /\btest/i.test(goal)
  const tasks: AgentTask[] = []
  const roles = new Map<string, string>()

  if (needsResearch) {
    tasks.push(makeTask("t1", "Research approach", researchInstructions(spec), []))
    roles.set("t1", "researcher")
    tasks.push(makeTask("t2", "Implement solution", implementInstructions(spec, true), ["t1"]))
    roles.set("t2", "coder")
  } else {
    tasks.push(makeTask("t1", "Implement solution", implementInstructions(spec, false), []))
    roles.set("t1", "coder")
  }

  if (needsTests) {
    const dep = tasks[tasks.length - 1].id
    const id = `t${tasks.length + 1}`
    tasks.push(
      makeTask(
        id,
        "Write tests",
        `Write focused tests for the implementation of: ${goal}\nExpected output: test files and a short report of cases covered.\nDo not change production behavior except to fix a failing assertion you introduce.`,
        [dep]
      )
    )
    roles.set(id, "tester")
  }

  return { tasks, roles }
}

function fromModel(raw: string): PlannedGraph | null {
  const parsed = extractJson(raw)
  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.tasks)
      ? parsed.tasks
      : null
  if (!list) return null

  const roles = new Map<string, string>()
  const tasks: AgentTask[] = []

  for (let i = 0; i < list.length && tasks.length < MAX_TASKS; i++) {
    const item = list[i]
    if (!isRecord(item)) continue
    const title = asString(item.title, `Task ${i + 1}`).trim() || `Task ${i + 1}`
    const id = normalizeTaskId(asString(item.id, `t${i + 1}`), i)
    const instructions = asString(item.instructions, title).trim() || selfContained(title)
    const dependsOn = normalizeDeps(item.dependsOn)
    const assignedModel =
      typeof item.assignedModel === "string" && item.assignedModel.trim()
        ? item.assignedModel.trim()
        : undefined
    const task: AgentTask = {
      id: uniquify(id, tasks),
      title,
      instructions,
      dependsOn,
      status: "queued",
    }
    if (assignedModel) task.assignedModel = assignedModel
    tasks.push(task)
    const role = asString(item.role, "coder").trim().toLowerCase()
    roles.set(task.id, KNOWN_ROLES.has(role) ? role : "coder")
  }

  if (tasks.length === 0) return null
  return { tasks, roles }
}

function uniquify(id: string, existing: AgentTask[]): string {
  if (!existing.some((t) => t.id === id)) return id
  let n = 2
  while (existing.some((t) => t.id === `${id}-${n}`)) n += 1
  return `${id}-${n}`
}

function normalizeDeps(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim().toLowerCase()
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

function makeTask(id: string, title: string, instructions: string, dependsOn: string[]): AgentTask {
  return { id, title, instructions, dependsOn, status: "queued" }
}

function selfContained(title: string): string {
  return `Complete "${title}" against the shared spec.\nExpected output: the finished artifact and a short note of what changed.\nDo not touch unrelated files or invent requirements.`
}

function implementInstructions(spec: SharedSpec, afterResearch: boolean): string {
  const prefix = afterResearch ? "Using the research from t1, implement the goal.\n" : ""
  return `${prefix}Objective: ${spec.goal}\nExpected output: complete implementation, no placeholders.\nBoundaries: do not change scope, do not add features outside the spec, do not restyle contrary to styleGuide.`
}

function researchInstructions(spec: SharedSpec): string {
  return `Research approaches for: ${spec.goal}\nExpected output: a short brief with a recommended approach and rejected alternatives.\nDo not write implementation code.`
}

function formatSpecForPlanner(spec: SharedSpec): string {
  const lines = [`Goal: ${spec.goal}`]
  const keys = Object.keys(spec.constraints)
  if (keys.length > 0) {
    lines.push("Constraints:")
    for (const k of keys) lines.push(`- ${k}: ${spec.constraints[k]}`)
  }
  if (spec.styleGuide) {
    const sk = Object.keys(spec.styleGuide)
    if (sk.length > 0) {
      lines.push("Style guide:")
      for (const k of sk) lines.push(`- ${k}: ${spec.styleGuide[k]}`)
    }
  }
  return lines.join("\n")
}
