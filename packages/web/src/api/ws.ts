import type { WsInbound } from "./contract.js"
import { connectSse, runEventsUrl, type EventStream } from "./stream.js"

export type { EventStream as EventSocket }

export function connectEventSocket(
  url: string,
  onMessage: (msg: WsInbound) => void,
  onStatus?: (state: "open" | "closed" | "error") => void,
): EventStream {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return connectLegacySocket(url, onMessage, onStatus)
  }
  return connectSse(url, onMessage, onStatus)
}

export function wsUrlFor(runId: string, origin = location.origin): string {
  return runEventsUrl(runId, origin)
}

function connectLegacySocket(
  url: string,
  onMessage: (msg: WsInbound) => void,
  onStatus?: (state: "open" | "closed" | "error") => void,
): EventStream {
  const socket = new WebSocket(url)
  socket.addEventListener("open", () => onStatus?.("open"))
  socket.addEventListener("close", () => onStatus?.("closed"))
  socket.addEventListener("error", () => onStatus?.("error"))
  socket.addEventListener("message", (ev) => {
    try {
      const parsed = JSON.parse(String(ev.data)) as WsInbound
      if (parsed && (parsed.channel === "orchestrator" || parsed.channel === "permission")) {
        onMessage(parsed)
      }
    } catch {
      onStatus?.("error")
    }
  })
  return {
    close() {
      socket.close()
    },
  }
}
