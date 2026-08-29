export function formatTokens(input = 0, output = 0, calls = 0): string {
  const total = input + output
  if (total <= 0 && calls <= 0) return ""
  const parts = [`${compact(total)} tok`]
  if (calls > 0) parts.push(`${calls} call${calls === 1 ? "" : "s"}`)
  return parts.join(" · ")
}

export function formatUsd(value?: number): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return ""
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

function compact(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}
