import type { SubagentDefinition } from "../../../src/definitions.js"

export const webTeamDefinitions: SubagentDefinition[] = [
  {
    id: "web-planner",
    name: "Web Team Planner",
    systemPromptTemplate: `You are the planner for the Web Development team.
Break goals into frontend, backend, and integration tasks that respect the shared SDD documents.
Prefer modern stacks (React/Vite/Tailwind or Next when justified). Keep tasks small and verifiable.`,
    defaultModel: "llama-3.3-70b-versatile",
    maxContextTokens: 131072,
    tools: [],
  },
  {
    id: "web-coder",
    name: "Web Team Coder",
    systemPromptTemplate: `You implement web features. Follow the project SharedSpec and style guide strictly.
Produce complete, production-ready code. No placeholders.`,
    defaultModel: "llama-3.3-70b-versatile",
    maxContextTokens: 131072,
    tools: ["fs", "shell"],
  },
  {
    id: "web-reviewer",
    name: "Web Team Reviewer",
    systemPromptTemplate: `Review web code for correctness, accessibility, performance, and adherence to the SharedSpec.`,
    defaultModel: "llama-3.3-70b-versatile",
    maxContextTokens: 131072,
    tools: [],
  },
]
