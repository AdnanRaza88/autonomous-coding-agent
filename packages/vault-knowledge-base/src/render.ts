import { stringifyFrontmatter } from "./frontmatter.js"
import { kindFromProperties } from "./paths.js"
import { parseWikiLinks, renderRelatedSection, uniqueTitles } from "./wiki.js"
import type { ParsedNote, VaultEntity, VaultNoteKind } from "./types.js"
import { parseFrontmatter } from "./frontmatter.js"

export function renderNote(entity: VaultEntity): string {
  const kind = kindFromProperties({ kind: entity.properties.kind ?? "", ...entity.properties })
  const properties: Record<string, string> = {
    id: entity.id,
    title: entity.title,
    kind,
    updated: entity.properties.updated ?? new Date().toISOString(),
    ...entity.properties,
  }
  delete properties.body
  const body = composeBody(entity.title, entity.body, entity.links)
  return stringifyFrontmatter(properties, body)
}

export function composeBody(title: string, body: string, links: string[]): string {
  const trimmed = body.replace(/^\uFEFF/, "").trim()
  const heading = `# ${title}`
  let main = trimmed
  if (!main) main = heading
  else if (!/^#\s+/m.test(main)) main = `${heading}\n\n${main}`
  const existing = new Set(parseWikiLinks(main).map((l) => l.target.trim().toLowerCase()))
  const extra = uniqueTitles(links).filter((t) => !existing.has(t.toLowerCase()))
  if (extra.length === 0) return main.endsWith("\n") ? main : `${main}\n`
  if (/^## Related\s*$/m.test(main)) {
    return appendRelated(main, extra)
  }
  return `${main.replace(/\s*$/, "")}\n\n${renderRelatedSection(extra)}`
}

function appendRelated(main: string, extra: string[]): string {
  const lines = extra.map((t) => `- [[${t}]]`)
  return `${main.replace(/\s*$/, "")}\n${lines.join("\n")}\n`
}

export function parseNoteText(raw: string): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(raw)
  return { frontmatter, body, links: parseWikiLinks(body) }
}

export function noteKind(frontmatter: Record<string, string>): VaultNoteKind {
  return kindFromProperties(frontmatter)
}
