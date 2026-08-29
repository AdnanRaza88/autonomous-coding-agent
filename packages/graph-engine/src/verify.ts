import type { AgentTask, ChatMessage, ProviderConfig, SharedSpec } from "@agent-core/types"
import { asString, extractJson, isRecord } from "./json.js"

export type VerifyVerdict = {
  pass: boolean
  feedback: string
}

const SYSTEM = `You are a black-box verifier. You see the shared spec, the task instructions, and the worker output.
You do not see how the work was produced.
Return JSON only: { "pass": true|false, "feedback": "one short paragraph" }
Pass only if the output fulfills the task and does not violate the spec.
If it fails, say exactly what to fix. Do not rewrite the work.`

export async function verifyResult(
  task: AgentTask,
  spec: SharedSpec,
  output: string,
  config: ProviderConfig,
  chat: (config: ProviderConfig, messages: ChatMessage[]) => Promise<string>
): Promise<VerifyVerdict> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Goal: ${spec.goal}`,
        formatMap("Constraints", spec.constraints),
        spec.styleGuide ? formatMap("Style guide", spec.styleGuide) : "",
        `Task: ${task.title}`,
        task.instructions,
        "--- output ---",
        clip(output, 12000),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]

  let raw: string
  try {
    raw = await chat(config, messages)
  } catch (err) {
    return {
      pass: false,
      feedback: err instanceof Error ? err.message : "verifier call failed",
    }
  }

  const parsed = extractJson(raw)
  if (isRecord(parsed) && typeof parsed.pass === "boolean") {
    return {
      pass: parsed.pass,
      feedback: asString(parsed.feedback, parsed.pass ? "ok" : "failed verification").trim(),
    }
  }

  return heuristicVerify(task, spec, output)
}

export function heuristicVerify(task: AgentTask, spec: SharedSpec, output: string): VerifyVerdict {
  const text = output.trim()
  if (!text) {
    return { pass: false, feedback: "output is empty; produce the artifact described in the task" }
  }
  if (text.length < 12) {
    return { pass: false, feedback: "output is too short to satisfy the task instructions" }
  }
  const lowered = text.toLowerCase()
  if (/\b(todo|fixme|placeholder|not implemented)\b/.test(lowered)) {
    return { pass: false, feedback: "output still contains placeholders; finish the work" }
  }
  const theme = spec.styleGuide?.theme
  if (theme && /theme/i.test(task.instructions) && !lowered.includes(theme.toLowerCase())) {
    return { pass: false, feedback: `output does not respect styleGuide.theme=${theme}` }
  }
  return { pass: true, feedback: "ok" }
}

export function appendFeedback(instructions: string, feedback: string, attempt: number): string {
  const block = `\n\nVerifier feedback from attempt ${attempt}:\n${feedback.trim()}\nRevise the previous output to address every point above. Keep what already matches the spec.`
  return `${instructions}${block}`
}

function formatMap(label: string, map: Record<string, string>): string {
  const keys = Object.keys(map)
  if (keys.length === 0) return ""
  return `${label}:\n${keys.map((k) => `- ${k}: ${map[k]}`).join("\n")}`
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n[truncated]`
}
