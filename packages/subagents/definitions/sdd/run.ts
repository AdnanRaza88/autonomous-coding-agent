import type { ProviderAdapter, ProviderConfig, SharedSpec } from "@agent-core/types"
import { getAdapter } from "@agent-core/providers"
import { registerSubagentDefinition } from "../../src/definitions.js"
import { getSddDefinition } from "./definition.js"
import {
  extractOpenQuestions,
  extractSharedSpec,
  goalLooksAmbiguous,
} from "./parse.js"
import { analyzeDocuments } from "./analyze.js"
import {
  CONSTITUTION_USER,
  SPEC_USER,
  PLAN_USER,
  TASKS_USER,
  ANALYZE_USER,
} from "./prompts.js"
import type { AnalyzeReport } from "./analyze.js"
import type { OpenQuestion } from "./parse.js"

export type RunSddOptions = {
  adapter?: ProviderAdapter
  now?: () => Date
}

export type SddResult = {
  constitution: string
  spec: string
  plan: string
  tasks: string
  analysis: AnalyzeReport
  questions: OpenQuestion[]
  sharedSpec: SharedSpec
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
  const createdAt = (options?.now ?? (() => new Date()))().toISOString()

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
  void analysisFromModel

  const analysis = analyzeDocuments({
    constitution,
    spec,
    plan,
    tasks,
  })

  const planQuestions = extractOpenQuestions(plan, "plan")
  const questions = [...specQuestions, ...planQuestions]

  const sharedSpec = extractSharedSpec(plan, goal, createdAt)

  return {
    constitution,
    spec,
    plan,
    tasks,
    analysis,
    questions,
    sharedSpec,
  }
}

async function stage(
  adapter: ProviderAdapter,
  config: ProviderConfig,
  userContent: string
): Promise<string> {
  const out = await adapter.chat(config, [
    { role: "system", content: "You produce only the requested markdown document. No preamble." },
    { role: "user", content: userContent },
  ])
  return typeof out === "string" ? out : String(out)
}
