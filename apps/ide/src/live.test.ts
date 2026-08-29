import assert from "node:assert/strict"
import { test } from "node:test"
import {
  nextBackoff,
  parseSseBlock,
  permissionEventsUrl,
  readSseFrames,
  runEventsUrl,
  runSnapshotUrl,
  statusFromSnapshot,
  watchIdeRun,
} from "./live.js"
import type { StatusSnapshot } from "./types.js"

test("urls match the web control-plane contract", () => {
  assert.equal(runSnapshotUrl("http://127.0.0.1:3000", "r1"), "http://127.0.0.1:3000/api/runs/r1")
  assert.equal(runEventsUrl("http://127.0.0.1:3000", "r1", 3), "http://127.0.0.1:3000/api/runs/r1/events?after=3")
  assert.equal(permissionEventsUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/api/permissions/events")
})

test("statusFromSnapshot folds buffered events", () => {
  const status = statusFromSnapshot({
    runId: "r1",
    status: "running",
    tasks: [{ id: "t1", title: "A", instructions: "", dependsOn: [], status: "running" }],
    results: [],
    events: [
      { type: "planning" },
      { type: "plan_ready", tasks: [{ id: "t1", title: "A", instructions: "", dependsOn: [], status: "queued" }] },
      { type: "agent_start", taskId: "t1" },
    ],
  })
  assert.equal(status.phase, "running")
  assert.equal(status.running, 1)
})

test("watchIdeRun hydrates then consumes remaining frames", async () => {
  const seen: StatusSnapshot[] = []
  const types: string[] = []
  const handle = watchIdeRun({
    origin: "http://127.0.0.1:3000",
    runId: "r1",
    onStatus: (s) => seen.push(s),
    onEvent: (e) => types.push(e.type),
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/api/runs/r1")) {
        return new Response(
          JSON.stringify({
            runId: "r1",
            status: "running",
            tasks: [{ id: "t1", title: "A", instructions: "", dependsOn: [], status: "queued" }],
            results: [],
            events: [{ type: "planning" }, { type: "plan_ready", tasks: [{ id: "t1", title: "A", instructions: "", dependsOn: [], status: "queued" }] }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      assert.match(url, /after=1/)
      return new Response(
        'id: 2\nevent: orchestrator\ndata: {"channel":"orchestrator","runId":"r1","event":{"type":"agent_start","taskId":"t1"}}\n\nid: 3\nevent: orchestrator\ndata: {"channel":"orchestrator","runId":"r1","event":{"type":"run_complete","results":[{"taskId":"t1","output":"ok","attempt":1,"passed":true}]}}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    }) as typeof fetch,
  })
  await new Promise((r) => setTimeout(r, 30))
  handle.close()
  assert.ok(seen.length >= 2)
  assert.ok(types.includes("agent_start"))
  assert.ok(types.includes("run_complete"))
  assert.equal(seen[seen.length - 1]?.phase, "done")
})

test("parseSseBlock and backoff stay aligned with the web client", () => {
  const frames = parseSseBlock('id: 4\nevent: orchestrator\ndata: {"channel":"orchestrator"}\n\n')
  assert.equal(frames[0]?.id, "4")
  assert.equal(nextBackoff(3, 250, 8000), 2000)
})

test("readSseFrames stops on run_complete", async () => {
  const types: string[] = []
  await readSseFrames(
    'event: orchestrator\ndata: {"event":{"type":"agent_done","taskId":"t1","output":"x"}}\n\nevent: orchestrator\ndata: {"event":{"type":"run_complete","results":[]}}\n\nevent: orchestrator\ndata: {"event":{"type":"error","message":"late"}}\n\n',
    (event) => {
      types.push(event.type)
      return event.type === "run_complete"
    },
  )
  assert.deepEqual(types, ["agent_done", "run_complete"])
})
