import type { AgentResult, SharedSpec } from "@agent-core/types"

export interface ProjectContext {
  relevantMemories: string[]
  relevantKnowledgeGraphFacts: string[]
}

export interface StoredMemory {
  id: string
  content: string
  type?: string
  tags: string[]
  importance: number
  metadata: Record<string, unknown>
  createdAt: string
}

export interface GraphFact {
  id: string
  text: string
  source?: string
  kind: "fact" | "node" | "episode" | "edit"
  groupId: string
  createdAt: string
}

export interface RunCompleteRecord {
  runId?: string
  goal?: string
  spec?: SharedSpec
  results: AgentResult[]
  asked?: string
  decided?: string
  outcome?: string
}

export interface SddDocuments {
  constitution?: string
  spec?: string
  plan?: string
  tasks?: string
  analyze?: string
  goal?: string
}

export interface MemoryHealth {
  automem: "ok" | "down" | "skipped"
  graphiti: "ok" | "down" | "skipped"
}

export interface AutoMemClient {
  store(input: {
    content: string
    type?: string
    tags?: string[]
    importance?: number
    metadata?: Record<string, unknown>
  }): Promise<{ id: string }>
  recall(query: string, limit: number): Promise<StoredMemory[]>
  health(): Promise<boolean>
}

export interface GraphitiClient {
  addEpisode(input: {
    name: string
    body: string
    source?: "text" | "json" | "message"
    sourceDescription?: string
    groupId?: string
  }): Promise<{ id: string }>
  searchFacts(query: string, limit: number): Promise<GraphFact[]>
  searchNodes(query: string, limit: number): Promise<GraphFact[]>
  listRecent(limit: number): Promise<GraphFact[]>
  health(): Promise<boolean>
}
