import assert from "node:assert/strict"
import { test } from "node:test"
import {
  deployDetectUrl,
  deployEventsUrl,
  deployTargetsUrl,
  detectDeploy,
  fetchMemoryHealth,
  fetchVaultGraph,
  memoryHealthUrl,
  parseDeployFrames,
  vaultGraphUrl,
  watchIdeDeploy,
} from "./plane.js"

test("knowledge and deploy urls sit on the control plane", () => {
  assert.equal(memoryHealthUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/api/memory/health")
  assert.equal(vaultGraphUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/api/vault/graph")
  assert.equal(deployTargetsUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/api/deploy/targets")
  assert.equal(
    deployDetectUrl("http://127.0.0.1:3000", "r1"),
    "http://127.0.0.1:3000/api/deploy/detect?runId=r1",
  )
  assert.equal(
    deployEventsUrl("http://127.0.0.1:3000", "r1", 4),
    "http://127.0.0.1:3000/api/deploy/events?runId=r1&after=4",
  )
})

test("plane fetchers parse the knowledge contract", async () => {
  const health = await fetchMemoryHealth("http://127.0.0.1:3000", async (input) => {
    assert.equal(String(input), "http://127.0.0.1:3000/api/memory/health")
    return new Response(JSON.stringify({ automem: "ok", graphiti: "skipped" }), { status: 200 })
  })
  assert.equal(health.automem, "ok")
  const graph = await fetchVaultGraph("http://127.0.0.1:3000", async () => {
    return new Response(JSON.stringify({ nodes: [{ id: "home", title: "Home" }], edges: [] }), { status: 200 })
  })
  assert.equal(graph.nodes[0]?.id, "home")
  const detected = await detectDeploy("http://127.0.0.1:3000", "r1", async (input) => {
    assert.match(String(input), /runId=r1/)
    return new Response(JSON.stringify({ kind: "static", reasons: ["index.html"] }), { status: 200 })
  })
  assert.equal(detected.kind, "static")
})

test("watchIdeDeploy folds deploy SSE frames", async () => {
  const phases: string[] = []
  const handle = watchIdeDeploy({
    origin: "http://127.0.0.1:3000",
    runId: "r1",
    onProgress: (ev) => phases.push(ev.phase),
    fetchImpl: (async () =>
      new Response(
        'id: 1\nevent: deploy\ndata: {"channel":"deploy","event":{"runId":"r1","targetId":"vercel","phase":"building","message":"pack"}}\n\nid: 2\nevent: deploy\ndata: {"channel":"deploy","event":{"runId":"r1","targetId":"vercel","phase":"live","message":"Live","url":"https://x.vercel.app"}}\n\n',
        { status: 200 },
      )) as typeof fetch,
  })
  await new Promise((r) => setTimeout(r, 20))
  handle.close()
  assert.deepEqual(phases, ["building", "live"])
})

test("parseDeployFrames stops on failed", () => {
  const phases: string[] = []
  parseDeployFrames(
    'event: deploy\ndata: {"channel":"deploy","event":{"runId":"r","targetId":"fly","phase":"failed","message":"bad token"}}\n\nevent: deploy\ndata: {"channel":"deploy","event":{"runId":"r","targetId":"fly","phase":"live","message":"late"}}\n\n',
    (ev) => {
      phases.push(ev.phase)
      return ev.phase === "failed"
    },
  )
  assert.deepEqual(phases, ["failed"])
})
