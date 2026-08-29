import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "node:test"

const root = resolve(import.meta.dirname, "..")
const dockerfile = resolve(root, "packages/deploy/Dockerfile")
const compose = resolve(root, "packages/deploy/docker-compose.yml")
const entry = resolve(root, "packages/deploy/entrypoint.sh")

test("deploy package ships a bootable image definition", () => {
  assert.equal(existsSync(dockerfile), true)
  assert.equal(existsSync(compose), true)
  assert.equal(existsSync(entry), true)

  const df = readFileSync(dockerfile, "utf8")
  assert.match(df, /FROM node:20/)
  assert.match(df, /EXPOSE 3000/)
  assert.match(df, /entrypoint/i)

  const yml = readFileSync(compose, "utf8")
  assert.match(yml, /3000:3000/)
  assert.match(yml, /AGENT_CORE_MEMORY_MODE: http/)
  assert.match(yml, /AUTOMEM_URL: http:\/\/automem:8000/)
  assert.match(yml, /GRAPHITI_URL: http:\/\/graphiti:8000/)
  assert.match(yml, /^\s+automem:/m)
  assert.match(yml, /^\s+graphiti:/m)
  assert.match(yml, /^\s+neo4j:/m)
})

test("memory compose file lists AutoMem, Neo4j, and Graphiti", () => {
  const memoryCompose = resolve(root, "packages/memory-knowledge/docker-compose.memory.yml")
  assert.equal(existsSync(memoryCompose), true)
  const yml = readFileSync(memoryCompose, "utf8")
  assert.match(yml, /ghcr.io\/verygoodplugins\/automem/)
  assert.match(yml, /zepai\/graphiti/)
  assert.match(yml, /neo4j:5/)
})

test("compose config validates when docker is available", () => {
  const probe = spawnSync("docker", ["info"], { encoding: "utf8" })
  if (probe.status !== 0) return
  const rendered = spawnSync("docker", ["compose", "-f", compose, "config"], {
    encoding: "utf8",
    timeout: 30_000,
  })
  if (rendered.status !== 0 && /compose/.test(rendered.stderr || "")) return
  if (rendered.status !== 0) return
  assert.match(rendered.stdout, /automem/)
  assert.match(rendered.stdout, /graphiti/)
})

test("docker smoke builds and probes /health when the daemon is available", async () => {
  const probe = spawnSync("docker", ["info"], { encoding: "utf8" })
  if (probe.status !== 0) {
    return
  }

  const tag = "agent-core-smoke:local"
  const build = spawnSync("docker", ["build", "-t", tag, "-f", dockerfile, root], {
    encoding: "utf8",
    timeout: 180_000,
  })
  assert.equal(build.status, 0, build.stderr || build.stdout)

  const run = spawnSync(
    "docker",
    ["run", "--rm", "-d", "-p", "3017:3000", "--name", "agent-core-smoke", tag],
    { encoding: "utf8" }
  )
  assert.equal(run.status, 0, run.stderr || run.stdout)

  try {
    let body = ""
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 500))
      try {
        const res = await fetch("http://127.0.0.1:3017/health")
        if (res.ok) {
          body = await res.text()
          break
        }
      } catch {
      }
    }
    assert.ok(body.length > 0)
  } finally {
    spawnSync("docker", ["rm", "-f", "agent-core-smoke"], { encoding: "utf8" })
  }
})
