import { createServer } from "node:net"

export const DEFAULT_BACKEND_PORT = 3000
export const DEFAULT_PROXY_PORT = 17300
export const LOOPBACK = "127.0.0.1"

export async function portFree(port: number, host = LOOPBACK): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once("error", () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

export async function nextFreePort(start: number, host = LOOPBACK, attempts = 20): Promise<number> {
  let port = start
  for (let i = 0; i < attempts; i++) {
    if (await portFree(port, host)) return port
    port += 1
  }
  throw new Error(`no free port in ${start}..${start + attempts - 1}`)
}

export function loopbackOrigin(port: number): string {
  return `http://${LOOPBACK}:${port}`
}
