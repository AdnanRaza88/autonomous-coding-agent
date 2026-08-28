const SECRET_KEYS = new Set(["apiKey", "api_key", "authorization", "token", "password", "secret"])

export function looksLikeSecretKey(key: string): boolean {
  const k = key.toLowerCase()
  if (SECRET_KEYS.has(k)) return true
  return /(api[-_]?key|token|secret|password|authorization)/i.test(key)
}

export function maskSecrets<T>(value: T): T {
  return maskUnknown(value) as T
}

function maskUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskUnknown)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (looksLikeSecretKey(key) && typeof nested === "string") {
        out[key] = nested.length === 0 ? "" : "[redacted]"
      } else {
        out[key] = maskUnknown(nested)
      }
    }
    return out
  }
  return value
}

export function assertNoPlaintextKey(payload: unknown): void {
  walk(payload, "")
}

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`))
    return
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (looksLikeSecretKey(key) && typeof nested === "string" && nested.length > 0 && nested !== "[redacted]") {
        throw new Error(`plaintext secret at ${path}.${key}`)
      }
      walk(nested, path ? `${path}.${key}` : key)
    }
  }
}
