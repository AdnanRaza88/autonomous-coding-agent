import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { cryptoFail } from "./errors.js"
import { ensureDir } from "./paths.js"

const ALGO = "aes-256-gcm"
const KEY_BYTES = 32
const IV_BYTES = 12
const SALT_BYTES = 16
const TAG_BYTES = 16

export type EncryptedBlob = {
  v: 1
  iv: string
  tag: string
  salt: string
  data: string
}

export function generateMasterKey(): Buffer {
  return randomBytes(KEY_BYTES)
}

export function encodeKey(key: Buffer): string {
  return key.toString("hex")
}

export function decodeKey(hex: string): Buffer {
  const trimmed = hex.trim()
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw cryptoFail("master key must be 32-byte hex")
  }
  return Buffer.from(trimmed, "hex")
}

export function loadOrCreateMasterKey(keyPath: string, existing?: string): Buffer {
  if (existing && existing.trim()) return decodeKey(existing)
  if (process.env.AGENT_CORE_MASTER_KEY) return decodeKey(process.env.AGENT_CORE_MASTER_KEY)
  if (existsSync(keyPath)) {
    return decodeKey(readFileSync(keyPath, "utf8"))
  }
  ensureDir(dirname(keyPath))
  const key = generateMasterKey()
  writeFileSync(keyPath, encodeKey(key), { encoding: "utf8", mode: 0o600 })
  try {
    chmodSync(keyPath, 0o600)
  } catch {
    void 0
  }
  return key
}

function derive(master: Buffer, salt: Buffer): Buffer {
  return scryptSync(master, salt, KEY_BYTES, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
}

export function encryptSecret(master: Buffer, plaintext: string): EncryptedBlob {
  if (!plaintext) throw cryptoFail("refusing to encrypt empty secret")
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = derive(master, salt)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  if (tag.length !== TAG_BYTES) throw cryptoFail("unexpected gcm tag length")
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    salt: salt.toString("base64"),
    data: enc.toString("base64"),
  }
}

export function decryptSecret(master: Buffer, blob: EncryptedBlob): string {
  if (!blob || blob.v !== 1) throw cryptoFail("unsupported ciphertext version")
  const salt = Buffer.from(blob.salt, "base64")
  const iv = Buffer.from(blob.iv, "base64")
  const tag = Buffer.from(blob.tag, "base64")
  const data = Buffer.from(blob.data, "base64")
  const key = derive(master, salt)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const out = Buffer.concat([decipher.update(data), decipher.final()])
  return out.toString("utf8")
}

export function sealJson(master: Buffer, value: unknown): EncryptedBlob {
  return encryptSecret(master, JSON.stringify(value))
}

export function openJson<T>(master: Buffer, blob: EncryptedBlob): T {
  return JSON.parse(decryptSecret(master, blob)) as T
}

export function keysEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
