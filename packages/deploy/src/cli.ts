import { startServer, webDistGuess } from "./server.js"
import { DEFAULT_PORT } from "./paths.js"

const port = Number(process.env.PORT ?? DEFAULT_PORT)

const handle = await startServer({
  port,
  webRoot: webDistGuess(),
})

const shutdown = async () => {
  await handle.close()
  process.exit(0)
}

process.on("SIGTERM", () => {
  void shutdown()
})
process.on("SIGINT", () => {
  void shutdown()
})
