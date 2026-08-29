import type { ChatMessage, ProviderAdapter, ProviderConfig, SharedSpec } from "@agent-core/types"
import { getAdapter } from "@agent-core/providers"
import { registerSubagentDefinition } from "../../src/definitions.js"
import { getSddDefinition } from "./definition.js"
import {
  ANALYZE_USER,
  CONSTITUTION_USER,
  PLAN_USER,
  SPEC_USER,
  SDD_SYSTEM,
  TASKS_USER,
} from "./prompts.js"
import {
  extractOpenQuestions,
  extractSharedSpec,
  goalLooksAmbiguous,
  unwrapFence,
  type OpenQuestion,
} from "./parse.js"
import { analyzeDocuments, type AnalyzeReport } from "./analyze.js"

export type SddResult = {
  constitution: string
  spec: string
  plan: string
  tasks: string
  sharedSpec: SharedSpec
  analysis: AnalyzeReport
  questions: OpenQuestion[]
}

export type RunSddOptions = {
  adapter?: ProviderAdapter
  now?: () => Date
}

let registered = false

export function ensureSddRegistered(): void {
  if (registered) return
  registerSubagentDefinition(getSddDefinition())
  registered = true
}

export async function runSddSubagent(
  userGoal: string,
  providerConfig: ProviderConfig,
  options?: RunSddOptions
): Promise<SddResult> {
  ensureSddRegistered()

  const goal = typeof userGoal === "string" ? userGoal.trim() : ""
  if (!goal) throw new Error("userGoal must be a non-empty string")

  const adapter = options?.adapter ?? getAdapter(providerConfig)
  const createdAt = (options?.now ?? (() => new Date())).toISOString()

  const constitution = await stage(adapter, providerConfig, CONSTITUTION_USER(goal))
  const specPrompt = goalLooksAmbiguous(goal)
    ? `${SPEC_USER(goal, constitution)}\n\nThe goal is underspecified. You must include an Open questions section.`
    : SPEC_USER(goal, constitution)
  const spec = await stage(adapter, providerConfig, specPrompt)
  const specQuestions = extractOpenQuestions(spec, "spec")

  const plan = await stage(adapter, providerConfig, PLAN_USER(goal, constitution, spec))
  const tasks = await stage(adapter, providerConfig, TASKS_USER(goal, plan))

  const analysisFromModel = await stage(
    adapter,
    providerConfig,
    ANALYZE_USER(constitution, spec, plan, tasks)
  )
  const analysis = analyzeDocuments({ constitution, spec, plan, tasks })
  if (!analysis.ready && /verdict:\s*ready/i.test(analysisFromModel)) {
    analysis.summary = `${analysis.summary}; model claimed ready`
  }

  const sharedSpec = extractSharedSpec(plan, goal, createdAt)
  if (!sharedSpec.constraints.constitution) {
    sharedSpec.constraints.constitution = "see constitution.md"
  }

  const questions: OpenQuestion[] = [
    ...specQuestions,
    ...extractOpenQuestions(plan, "plan"),
    ...analysis.openQuestions.filter(
      (q) => !specQuestions.some((s) => s.text === q.text)
    ),
  ]

  return {
    constitution,
    spec,
    plan,
    tasks,
    sharedSpec,
    analysis,
    questions,
  }
}

async function stage(
  adapter: ProviderAdapter,
  config: ProviderConfig,
  user: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SDD_SYSTEM },
    { role: "user", content: user },
  ]
  const raw = await adapter.chat(config, messages)
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("SDD stage returned empty output")
  }
  return unwrapFence(raw)
}
