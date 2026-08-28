import type { WikiLink } from "./types.js"
import { slugify } from "./paths.js"

const WIKI_RE = /(?<![!])\[\[([^\[\]]+)\]\]/g

export function parseWikiLinks(body: string): WikiLink[] {
  const found: WikiLink[] = []
  const seen = new Set<string>()
  WIKI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_RE.exec(body))) {
    const raw = m[1].trim()
    if (!raw) continue
    const parsed = splitWikiTarget(raw)
    const key = `${parsed.target}#${parsed.heading ?? ""}|${parsed.alias ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ raw: m[0], ...parsed })
  }
  return found
}

export function splitWikiTarget(raw: string): { target: string; alias?: string; heading?: string } {
  let rest = raw.trim()
  let alias: string | undefined
  const pipe = rest.indexOf("|")
  if (pipe >= 0) {
    alias = rest.slice(pipe + 1).trim() || undefined
    rest = rest.slice(0, pipe).trim()
  }
  let heading: string | undefined
  const hash = rest.indexOf("#")
  if (hash >= 0) {
    heading = rest.slice(hash + 1).trim() || undefined
    rest = rest.slice(0, hash).trim()
  }
  rest = rest.replace(/\.md$/i, "")
  const parts = rest.split(/[\\/]/)
  const target = parts[parts.length - 1] ?? rest
  return { target, alias, heading }
}

export function linkTargetKey(target: string): string {
  return slugify(target.replace(/\.md$/i, ""))
}

export function ensureWikiLinks(body: string, titles: string[]): string {
  let next = body
  for (const title of titles) {
    const t = title.trim()
    if (!t) continue
    if (bodyHasLinkTo(next, t)) continue
    next = next.replace(/\s*$/, "") + `\n- [[${t}]]\n`
  }
  return next
}

export function bodyHasLinkTo(body: string, target: string): boolean {
  const want = linkTargetKey(target)
  return parseWikiLinks(body).some((l) => linkTargetKey(l.target) === want)
}

export function renderRelatedSection(links: string[]): string {
  const unique = uniqueTitles(links)
  if (unique.length === 0) return ""
  const lines = ["## Related", ""]
  for (const title of unique) lines.push(`- [[${title}]]`)
  return `${lines.join("\n")}\n`
}

export function uniqueTitles(links: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const link of links) {
    const t = link.trim()
    if (!t) continue
    const key = linkTargetKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
