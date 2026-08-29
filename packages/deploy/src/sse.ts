export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
}

export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function parseSseBlock(chunk: string): { event: string; data: string }[] {
  const frames: { event: string; data: string }[] = []
  const parts = chunk.split("\n\n")
  for (const part of parts) {
    if (!part.trim()) continue
    let event = "message"
    const dataLines: string[] = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length) frames.push({ event, data: dataLines.join("\n") })
  }
  return frames
}
