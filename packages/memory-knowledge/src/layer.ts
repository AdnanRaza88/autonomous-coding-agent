import { type MemoryConfig, defaultMemoryConfig } from "./config.js"
import { createAutoMemClient } from "./automem.js"
import { createGraphitiClient } from "./graphiti.js"
import { getProjectContextFor } from "./context.js"
import { applyUserFactEdit, listGraphFacts, type UserFactEdit } from "./facts.js"
import { createLocalAutoMem, createLocalGraphiti } from "./local.js"
import { recordRunComplete, recordRunCompleteFromEvent } from "./run-complete.js"
import { ingestSddDocuments } from "./sdd.js"
import type {
  AutoMemClient,
  GraphitiClient,
  MemoryHealth,
  ProjectContext,
  RunCompleteRecord,
  SddDocuments,
} from "./types.js"
import type { OrchestratorEvent } from "@agent-core/types"

export interface MemoryLayer {
  config: MemoryConfig
  automem: AutoMemClient
  graphiti: GraphitiClient
  getProjectContext(query: string): Promise<ProjectContext>
  recordRunComplete(record: RunCompleteRecord): Promise<{ id: string }>
  recordRunCompleteFromEvent(
    event: OrchestratorEvent,
    extra?: Omit<RunCompleteRecord, "results">,
  ): Promise<{ id: string } | null>
  ingestSddDocuments(docs: SddDocuments): Promise<{ ids: string[]; skipped: string[] }>
  applyUserFactEdit(edit: UserFactEdit): Promise<{ id: string }>
  listGraphFacts(query: string, limit?: number): ReturnType<typeof listGraphFacts>
  health(): Promise<MemoryHealth>
}

export interface CreateMemoryLayerOptions {
  config?: MemoryConfig
  automem?: AutoMemClient
  graphiti?: GraphitiClient
  mode?: "http" | "local"
}

export function createMemoryLayer(opts: CreateMemoryLayerOptions = {}): MemoryLayer {
  const config = opts.config ?? defaultMemoryConfig()
  const mode = opts.mode ?? inferMode()
  const automem = opts.automem ?? (mode === "local" ? createLocalAutoMem() : createAutoMemClient(config.automem))
  const graphiti = opts.graphiti ?? (mode === "local" ? createLocalGraphiti(config.graphiti.groupId) : createGraphitiClient(config.graphiti))

  return {
    config,
    automem,
    graphiti,
    getProjectContext(query) {
      return getProjectContextFor(query, { automem, graphiti }, config)
    },
    recordRunComplete(record) {
      return recordRunComplete(automem, record)
    },
    recordRunCompleteFromEvent(event, extra) {
      return recordRunCompleteFromEvent(automem, event, extra)
    },
    ingestSddDocuments(docs) {
      return ingestSddDocuments(graphiti, docs)
    },
    applyUserFactEdit(edit) {
      return applyUserFactEdit(graphiti, edit)
    },
    listGraphFacts(query, limit) {
      return listGraphFacts(graphiti, query, limit)
    },
    async health() {
      const [a, g] = await Promise.all([automem.health(), graphiti.health()])
      return { automem: a ? "ok" : "down", graphiti: g ? "ok" : "down" }
    },
  }
}

let active: MemoryLayer | undefined

export function setMemoryLayer(layer: MemoryLayer): MemoryLayer {
  active = layer
  return layer
}

export function getMemoryLayer(): MemoryLayer {
  if (!active) active = createMemoryLayer()
  return active
}

export function resetMemoryLayer(): void {
  active = undefined
}

export function getProjectContext(query: string): Promise<ProjectContext> {
  return getMemoryLayer().getProjectContext(query)
}

function inferMode(): "http" | "local" {
  const raw = (process.env.AGENT_CORE_MEMORY_MODE ?? "").toLowerCase()
  if (raw === "local" || raw === "memory" || raw === "test") return "local"
  if (raw === "http") return "http"
  if (process.env.NODE_ENV === "test") return "local"
  return "http"
}
