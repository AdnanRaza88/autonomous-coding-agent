const FENCE = "---"

export function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, "")
  if (!text.startsWith(FENCE)) return { frontmatter: {}, body: stripLeadingNewlines(text) }
  const afterOpen = text.slice(FENCE.length)
  const close = afterOpen.search(/\r?\n---[ \t]*\r?\n/)
  if (close < 0) {
    const alt = afterOpen.search(/\r?\n---[ \t]*$/)
    if (alt < 0) return { frontmatter: {}, body: stripLeadingNewlines(text) }
    const block = afterOpen.slice(0, alt)
    return { frontmatter: parseYamlBlock(block), body: "" }
  }
  const match = afterOpen.match(/\r?\n---[ \t]*\r?\n/)
  const sepLen = match ? match[0].length : 5
  const block = afterOpen.slice(0, close)
  const rest = afterOpen.slice(close + sepLen)
  return { frontmatter: parseYamlBlock(block), body: stripLeadingNewlines(rest) }
}

export function stringifyFrontmatter(properties: Record<string, string>, body: string): string {
  const keys = Object.keys(properties).filter((k) => properties[k] !== undefined && properties[k] !== "")
  keys.sort((a, b) => keyOrder(a) - keyOrder(b) || a.localeCompare(b))
  const lines = [FENCE]
  for (const key of keys) {
    lines.push(`${key}: ${yamlScalar(properties[key])}`)
  }
  lines.push(FENCE)
  const trimmed = body.replace(/^\uFEFF/, "").replace(/^\n+/, "")
  return `${lines.join("\n")}\n\n${trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`}`
}

function parseYamlBlock(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = block.replace(/^\r?\n/, "").split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const idx = line.indexOf(":")
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    if (!/^[A-Za-z_][\w-]*$/.test(key)) continue
    const raw = line.slice(idx + 1).trim()
    out[key] = unquote(raw)
  }
  return out
}

function unquote(value: string): string {
  if (value === "true" || value === "false" || value === "null") return value
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\n/g, "\n")
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((p) => unquote(p.trim()))
      .filter(Boolean)
      .join(", ")
  }
  return value
}

function yamlScalar(value: string): string {
  if (value === "") return '""'
  if (/^(true|false|null|yes|no)$/i.test(value)) return `"${value}"`
  if (/[:#\[\]\{\}&*!|>'%@`]/.test(value) || /^\s|\s$/.test(value) || /\n/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
  }
  return value
}

function keyOrder(key: string): number {
  const order = ["id", "title", "kind", "aliases", "updated", "source"]
  const i = order.indexOf(key)
  return i === -1 ? 50 : i
}

function stripLeadingNewlines(s: string): string {
  return s.replace(/^\r?\n+/, "")
}
