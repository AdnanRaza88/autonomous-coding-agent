import { LOOPBACK } from "./ports.js"

export async function probeHttp(url: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } })
    if (!res.ok) return false
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return body?.ok === true || res.status === 200
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function healthUrl(port: number, path = "/api/health"): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `http://${LOOPBACK}:${port}${p}`
}

export async function waitHealthy(
  url: string,
  timeoutMs: number,
  intervalMs: number,
  probe: (u: string, t: number) => Promise<boolean>,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probe(url, Math.min(intervalMs, timeoutMs))) return true
    const left = deadline - Date.now()
    if (left <= 0) break
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, left)))
  }
  return false
}
