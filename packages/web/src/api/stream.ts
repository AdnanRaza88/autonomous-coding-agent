import type { PermissionPrompt, WsInbound } from "./contract.js"

export interface EventStream {
  close(): void
}

export function parseSseBlock(chunk: string): { event: string; data: string }[] {
  const frames: { event: string; data: string }[] = []
  for (const part of chunk.split("\n\n")) {
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

export function decodeInbound(event: string, data: string): WsInbound | undefined {
  try {
    const parsed = JSON.parse(data) as WsInbound
    if (event === "orchestrator" && parsed.channel === "orchestrator") return parsed
    if (event === "permission" && parsed.channel === "permission") return parsed
    if (parsed.channel === "orchestrator" || parsed.channel === "permission") return parsed
  } catch {
    return undefined
  }
  return undefined
}

export function connectSse(
  url: string,
  onMessage: (msg: WsInbound) => void,
  onStatus?: (state: "open" | "closed" | "error") => void,
): EventStream {
  const source = new EventSource(url)
  const handle = (ev: MessageEvent<string>) => {
    const inbound = decodeInbound(ev.type, String(ev.data))
    if (inbound) onMessage(inbound)
  }
  source.addEventListener("open", () => onStatus?.("open"))
  source.addEventListener("error", () => {
    if (source.readyState === EventSource.CLOSED) onStatus?.("closed")
    else onStatus?.("error")
  })
  source.addEventListener("orchestrator", handle as EventListener)
  source.addEventListener("permission", handle as EventListener)
  source.addEventListener("message", handle as EventListener)
  return {
    close() {
      source.close()
      onStatus?.("closed")
    },
  }
}

export function runEventsUrl(runId: string, origin = typeof location !== "undefined" ? location.origin : ""): string {
  return `${origin}/api/runs/${encodeURIComponent(runId)}/events`
}

export function permissionEventsUrl(origin = typeof location !== "undefined" ? location.origin : ""): string {
  return `${origin}/api/permissions/events`
}

export function watchRunEvents(
  runId: string,
  onEvent: (msg: Extract<WsInbound, { channel: "orchestrator" }>) => void,
  onStatus?: (state: "open" | "closed" | "error") => void,
): EventStream {
  return connectSse(
    runEventsUrl(runId),
    (msg) => {
      if (msg.channel === "orchestrator") onEvent(msg)
    },
    onStatus,
  )
}

export function watchPermissions(
  onPrompt: (prompt: PermissionPrompt) => void,
  onStatus?: (state: "open" | "closed" | "error") => void,
): EventStream {
  return connectSse(
    permissionEventsUrl(),
    (msg) => {
      if (msg.channel === "permission") onPrompt(msg.prompt)
    },
    onStatus,
  )
}
