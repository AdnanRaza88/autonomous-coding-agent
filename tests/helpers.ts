import type { ChatMessage, ProviderAdapter, ProviderConfig } from "@agent-core/types"

export const mockConfig: ProviderConfig = {
  id: "mock",
  baseUrl: "http://127.0.0.1",
  apiKey: "test",
  model: "mock",
  contextWindow: 8192,
}

export const groqConfig: ProviderConfig = {
  id: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "test",
  model: "llama-3.1-8b-instant",
  contextWindow: 131072,
}

export const ollamaConfig: ProviderConfig = {
  id: "ollama",
  baseUrl: "http://127.0.0.1:11434/v1",
  apiKey: "local",
  model: "llama3.1",
  contextWindow: 8192,
}

export function scriptedChat(
  replies: Record<string, string>
): (config: ProviderConfig, messages: ChatMessage[]) => Promise<string> {
  return async (_config, messages) => {
    const blob = messages.map((m) => m.content).join("\n")
    if (blob.includes("You write a SharedSpec")) {
      return (
        replies.spec ??
        `{"goal":"ship a cli","constraints":{"language":"TypeScript"},"styleGuide":{"theme":"light"}}`
      )
    }
    if (blob.includes("You are the planner")) {
      return (
        replies.plan ??
        JSON.stringify({
          tasks: [
            {
              id: "t1",
              title: "Build parser",
              instructions: "Write the parser.",
              dependsOn: [],
              role: "coder",
            },
            {
              id: "t2",
              title: "Build CLI",
              instructions: "Write the CLI.",
              dependsOn: [],
              role: "coder",
            },
          ],
        })
      )
    }
    if (blob.includes("You are a black-box verifier")) {
      return replies.verify ?? `{"pass":true,"feedback":"ok"}`
    }
    return replies.default ?? "done"
  }
}

export function scriptedAdapter(replies: Record<string, string>): ProviderAdapter {
  const chat = scriptedChat(replies)
  return {
    chat: (config, messages) => chat(config, messages),
  }
}
