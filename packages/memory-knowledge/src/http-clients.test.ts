import assert from "node:assert/strict"
import http from "node:http"
import { test } from "node:test"
import { createAutoMemClient } from "./automem.js"
import { createGraphitiClient } from "./graphiti.js"
import { MemoryServiceError } from "./errors.js"
import { requestJson } from "./http.js"

function listen(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<{
  url: string
  close: () => Promise<void>
}> {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") throw new Error("no port")
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

test("AutoMem client stores and recalls against REST shapes", async () => {
  const stored: unknown[] = []
  const srv = await listen((req, res) => {
    const url = new URL(req.url ?? "/", "http://x")
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ status: "ok" }))
      return
    }
    if (req.method === "POST" && url.pathname === "/memory") {
      let body = ""
      req.on("data", (c) => (body += c))
      req.on("end", () => {
        stored.push(JSON.parse(body))
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "success", memory_id: "m1" }))
      })
      return
    }
    if (req.method === "GET" && url.pathname === "/recall") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          status: "success",
          results: [{ memory_id: "m1", content: "Chose SQLite over Postgres", type: "Decision", tags: ["db"], importance: 0.9 }],
        }),
      )
      return
    }
    res.writeHead(404)
    res.end()
  })
  try {
    const client = createAutoMemClient({ baseUrl: srv.url, token: "t", timeoutMs: 2_000 })
    assert.equal(await client.health(), true)
    const saved = await client.store({ content: "Chose SQLite over Postgres", tags: ["db"] })
    assert.equal(saved.id, "m1")
    const hits = await client.recall("database", 5)
    assert.equal(hits[0]?.content, "Chose SQLite over Postgres")
    assert.equal((stored[0] as { type: string }).type, "Decision")
  } finally {
    await srv.close()
  }
})

test("Graphiti client posts episodes and parses fact/node search", async () => {
  const srv = await listen((req, res) => {
    const url = new URL(req.url ?? "/", "http://x")
    if (url.pathname === "/episodes" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ episode_uuid: "e1", status: "processing" }))
      return
    }
    if (url.pathname === "/search/facts") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ results: [{ uuid: "f1", fact: "SQLite is the persistence layer" }] }))
      return
    }
    if (url.pathname === "/search/nodes") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ results: [{ uuid: "n1", name: "SQLite", summary: "Embedded SQL engine" }] }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  try {
    const client = createGraphitiClient({ baseUrl: srv.url, groupId: "agent-core", timeoutMs: 2_000 })
    const ep = await client.addEpisode({ name: "spec.md", body: "SQLite only" })
    assert.equal(ep.id, "e1")
    const facts = await client.searchFacts("sqlite", 5)
    assert.equal(facts[0]?.text, "SQLite is the persistence layer")
    const nodes = await client.searchNodes("sqlite", 5)
    assert.equal(nodes[0]?.text, "Embedded SQL engine")
  } finally {
    await srv.close()
  }
})

test("requestJson retries 503 then succeeds", async () => {
  let hits = 0
  const srv = await listen((_req, res) => {
    hits += 1
    if (hits === 1) {
      res.writeHead(503)
      res.end("busy")
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
  })
  try {
    const raw = await requestJson("automem", srv.url, { timeoutMs: 2_000, retries: 2 })
    assert.deepEqual(raw, { ok: true })
    assert.equal(hits, 2)
  } finally {
    await srv.close()
  }
})

test("requestJson surfaces 400 without retry storm", async () => {
  let hits = 0
  const srv = await listen((_req, res) => {
    hits += 1
    res.writeHead(400)
    res.end("bad")
  })
  try {
    await assert.rejects(() => requestJson("graphiti", srv.url, { timeoutMs: 1_000, retries: 3 }), MemoryServiceError)
    assert.equal(hits, 1)
  } finally {
    await srv.close()
  }
})
