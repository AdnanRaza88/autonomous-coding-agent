import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import type { SharedSpec } from "@agent-core/types"
import { DeployError } from "./errors.js"
import {
  getDeployTarget,
  listDeployTargets,
  registerDeployTarget,
  resetDeployTargets,
} from "./registry.js"
import type { DeployTarget } from "./types.js"

const stub: DeployTarget = {
  id: "stub",
  kind: "static",
  detect: () => true,
  deploy: async () => ({ url: "https://example.test", status: "live", targetId: "stub" }),
}

describe("registry", () => {
  beforeEach(() => {
    resetDeployTargets()
  })

  it("registers and lists targets", () => {
    registerDeployTarget(stub)
    assert.equal(listDeployTargets().length, 1)
    assert.equal(getDeployTarget("stub").id, "stub")
  })

  it("rejects empty ids", () => {
    assert.throws(
      () => registerDeployTarget({ ...stub, id: "  " }),
      (err: unknown) => err instanceof DeployError && err.code === "unknown_target",
    )
  })

  it("throws on missing target", () => {
    assert.throws(
      () => getDeployTarget("missing"),
      (err: unknown) => err instanceof DeployError && err.code === "unknown_target",
    )
  })

  it("overwrites the same id", () => {
    registerDeployTarget(stub)
    registerDeployTarget({
      ...stub,
      detect: (_spec: SharedSpec) => false,
    })
    assert.equal(getDeployTarget("stub").detect({ goal: "x", constraints: {}, createdAt: "" }), false)
  })
})
