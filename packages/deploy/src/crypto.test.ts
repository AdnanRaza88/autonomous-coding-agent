import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { decryptSecret, encodeKey, encryptSecret, generateMasterKey, loadOrCreateMasterKey } from "./crypto.js"

test("round-trips a secret and refuses empty plaintext", () => {
  const key = generateMasterKey()
  const blob = encryptSecret(key, "sk-live-example")
  assert.equal(blob.v, 1)
  assert.equal(decryptSecret(key, blob), "sk-live-example")
  assert.throws(() => encryptSecret(key, ""))
})

test("creates a 32-byte hex key file once and reuses it", () => {
  const dir = mkdtempSync(join(tmpdir(), "ac-key-"))
  const path = join(dir, ".master.key")
  const first = loadOrCreateMasterKey(path)
  const second = loadOrCreateMasterKey(path)
  assert.equal(encodeKey(first), encodeKey(second))
  assert.match(readFileSync(path, "utf8").trim(), /^[0-9a-f]{64}$/)
})

test("wrong key cannot open ciphertext", () => {
  const blob = encryptSecret(generateMasterKey(), "token")
  assert.throws(() => decryptSecret(generateMasterKey(), blob))
})
