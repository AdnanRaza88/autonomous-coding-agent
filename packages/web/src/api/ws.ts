import type { WsInbound } from "./contract.js"

export interface EventSocket {
  close(): void
}

export function connectEventSocket(
  url: string,
  onMessage: (msg: WsInbound) => void,
  onStatus?: (state: "open" | "closed" | "error") => void
): EventSocket {
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

export function wsUrlFor(runId: string, origin = location.origin): string {
  const proto = origin.startsWith("https") ? "wss" : "ws"
  const host = origin.replace(/^https?:\/\//, "")
  return `${proto}://${host}/api/runs/${encodeURIComponent(runId)}/events`
}
