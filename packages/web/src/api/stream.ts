import type { PermissionPrompt, WsInbound } from "./contract.js"

export type StreamStatus = "open" | "closed" | "error" | "reconnecting"

export interface EventStream {
  close(): void
}

export interface ConnectSseOptions {
  after?: number
  maxAttempts?: number
  baseDelayMs?: number
  capDelayMs?: number
  sleep?: (ms: number) => Promise<void>
  eventSource?: typeof EventSource
}

export function parseSseBlock(chunk: string): { event: string; data: string; id?: string }[] {
  const frames: { event: string; data: string; id?: string }[] = []
  for (const part of chunk.split("\n\n")) {
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

export function nextBackoff(attempt: number, base = 250, cap = 8000): number {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt))
  return exp
}

export function withAfter(url: string, after?: number): string {
  if (after === undefined || after < 0) return url
  const abs = url.includes("://") ? new URL(url) : new URL(url, "http://127.0.0.1")
  abs.searchParams.set("after", String(after))
  if (!url.includes("://")) return `${abs.pathname}${abs.search}`
  return abs.toString()
}

export function terminalEvent(msg: WsInbound): boolean {
  return msg.channel === "orchestrator" && (msg.event.type === "run_complete" || msg.event.type === "error")
}

export function connectSse(
  url: string,
  onMessage: (msg: WsInbound) => void,
  onStatus?: (state: StreamStatus) => void,
  options: ConnectSseOptions = {},
): EventStream {
  const Source = options.eventSource ?? (typeof EventSource !== "undefined" ? EventSource : undefined)
  if (!Source) {
    throw new Error("EventSource is not available")
  }
  let closed = false
  let attempt = 0
  let after = options.after ?? -1
  let source: EventSource | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY
  const sleep = options.sleep

  const attach = () => {
    if (closed) return
    const target = withAfter(url, after)
    source = new Source(target)
    const handle = (ev: MessageEvent<string>) => {
      const inbound = decodeInbound(ev.type, String(ev.data))
      if (!inbound) return
      const stamped = Number((ev as MessageEvent & { lastEventId?: string }).lastEventId)
      if (Number.isFinite(stamped)) after = stamped
      onMessage(inbound)
      if (terminalEvent(inbound)) {
        closed = true
        source?.close()
        onStatus?.("closed")
      }
    }
    source.addEventListener("open", () => {
      attempt = 0
      onStatus?.("open")
    })
    source.addEventListener("error", () => {
      source?.close()
      if (closed) {
        onStatus?.("closed")
        return
      }
      if (attempt >= maxAttempts) {
        onStatus?.("error")
        return
      }
      onStatus?.("reconnecting")
      const delay = nextBackoff(attempt, options.baseDelayMs, options.capDelayMs)
      attempt += 1
      if (sleep) {
        void sleep(delay).then(attach)
        return
      }
      timer = setTimeout(attach, delay)
    })
    source.addEventListener("orchestrator", handle as EventListener)
    source.addEventListener("permission", handle as EventListener)
    source.addEventListener("message", handle as EventListener)
  }

  attach()
  return {
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      source?.close()
      onStatus?.("closed")
    },
  }
}

export function runEventsUrl(
  runId: string,
  origin = typeof location !== "undefined" ? location.origin : "",
  after?: number,
): string {
  return withAfter(`${origin}/api/runs/${encodeURIComponent(runId)}/events`, after)
}

export function permissionEventsUrl(origin = typeof location !== "undefined" ? location.origin : ""): string {
  return `${origin}/api/permissions/events`
}

export function watchRunEvents(
  runId: string,
  onEvent: (msg: Extract<WsInbound, { channel: "orchestrator" }>) => void,
  onStatus?: (state: StreamStatus) => void,
  options: ConnectSseOptions = {},
): EventStream {
  return connectSse(
    runEventsUrl(runId, typeof location !== "undefined" ? location.origin : "", options.after),
    (msg) => {
      if (msg.channel === "orchestrator") onEvent(msg)
    },
    onStatus,
    options,
  )
}

export function watchPermissions(
  onPrompt: (prompt: PermissionPrompt) => void,
  onStatus?: (state: StreamStatus) => void,
  options: ConnectSseOptions = {},
): EventStream {
  return connectSse(
    permissionEventsUrl(),
    (msg) => {
      if (msg.channel === "permission") onPrompt(msg.prompt)
    },
    onStatus,
    options,
  )
}
