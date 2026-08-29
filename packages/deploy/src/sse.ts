export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
}

export function formatSse(event: string, data: unknown, id?: string | number): string {
  const prefix = id === undefined ? "" : `id: ${id}\n`
  return `${prefix}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function parseSseBlock(chunk: string): { event: string; data: string; id?: string }[] {
  const frames: { event: string; data: string; id?: string }[] = []
  const parts = chunk.split("\n\n")
  for (const part of parts) {
    if (!part.trim()) continue
    let event = "message"
    let id: string | undefined
    const dataLines: string[] = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length) frames.push(id ? { event, data: dataLines.join("\n"), id } : { event, data: dataLines.join("\n") })
  }
  return frames
}

export function parseEventCursor(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return -1
  const n = typeof raw === "number" ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return -1
  return Math.max(-1, Math.floor(n))
}
