import type { VaultEntity } from "./types.js"

export interface GraphEntityInput {
  id: string
  name: string
  text?: string
  kind?: string
  groupId?: string
  related?: string[]
  source?: string
}

export function entityFromGraphRecord(input: GraphEntityInput): VaultEntity {
  const kind = mapKind(input.kind, input.name)
  return {
    id: input.id.trim(),
    title: input.name.trim() || input.id,
    body: (input.text ?? "").trim(),
    links: input.related ?? [],
    properties: {
      kind,
      source: input.source ?? "graphiti",
      group: input.groupId ?? "",
    },
  }
}

export function mapKind(kind: string | undefined, name: string): string {
  const raw = (kind ?? "").toLowerCase()
  if (raw === "module" || raw === "decision" || raw === "constraint" || raw === "run" || raw === "entity") {
    return raw
  }
  if (/decision|adr|chose|picked/.test(`${raw} ${name}`)) return "decision"
  if (/constraint|must|never|limit/.test(`${raw} ${name}`)) return "constraint"
  if (/module|package/.test(`${raw} ${name}`)) return "module"
  if (/run|session/.test(`${raw} ${name}`)) return "run"
  return "entity"
}

export async function writeGraphEntities(
  write: (entity: VaultEntity) => Promise<unknown>,
  records: GraphEntityInput[],
): Promise<number> {
  let count = 0
  for (const record of records) {
    if (!record.id.trim()) continue
    await write(entityFromGraphRecord(record))
    count += 1
  }
  return count
}
