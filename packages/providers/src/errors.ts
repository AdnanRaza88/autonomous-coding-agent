export type ProviderErrorCode =
  | "timeout"
  | "rate_limit"
  | "auth"
  | "invalid_request"
  | "server"
  | "network"
  | "unknown"
  | "context_overflow"
  | "quota"
  | "model_not_found"

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly status?: number
  readonly providerId: string
  readonly retryable: boolean
  readonly responseBody?: string

  constructor(
    message: string,
    opts: {
      code: ProviderErrorCode
      status?: number
      providerId: string
      retryable?: boolean
      cause?: unknown
      responseBody?: string
    }
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = "ProviderError"
    this.code = opts.code
    this.status = opts.status
    this.providerId = opts.providerId
    this.responseBody = opts.responseBody
    this.retryable =
      opts.retryable ??
      (opts.code === "timeout" ||
        opts.code === "rate_limit" ||
        opts.code === "server" ||
        opts.code === "network")
  }
}

function extractMessageFromBody(body: string): string | undefined {
  if (!body) return undefined
  if (/^\s*<!doctype|^\s*<html/i.test(body)) {
    return undefined
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (typeof parsed.message === "string" && parsed.message.length > 0) return parsed.message
    const err = parsed.error
    if (typeof err === "string" && err.length > 0) return err
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>
      if (typeof e.message === "string" && e.message.length > 0) return e.message
    }
    if (Array.isArray(parsed)) {
      const first = parsed[0] as Record<string, unknown> | undefined
      if (first && typeof first.error === "object" && first.error) {
        const e = first.error as Record<string, unknown>
        if (typeof e.message === "string") return e.message
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

function detectSpecialCode(
  status: number | undefined,
  body: string,
  extracted: string | undefined
): ProviderErrorCode | null {
  const hay = `${extracted ?? ""} ${body}`.toLowerCase()
  if (
    status === 413 ||
    hay.includes("context_length_exceeded") ||
    hay.includes("context window") ||
    hay.includes("maximum context length") ||
    hay.includes("prompt is too long") ||
    hay.includes("token limit") ||
    hay.includes("too many tokens") ||
    hay.includes("input is too long")
  ) {
    return "context_overflow"
  }
  if (
    hay.includes("insufficient_quota") ||
    hay.includes("quota exceeded") ||
    hay.includes("payment required") ||
    (hay.includes("credit") && hay.includes("exhaust"))
  ) {
    return "quota"
  }
  if (
    hay.includes("model_not_found") ||
    hay.includes("does not exist") ||
    hay.includes("invalid model") ||
    hay.includes("model is not available") ||
    (status === 404 && hay.includes("model"))
  ) {
    return "model_not_found"
  }
  return null
}

export function mapHttpError(status: number, body: string, providerId: string): ProviderError {
  const snippet = body.slice(0, 600)
  const extracted = extractMessageFromBody(body)
  const detail = extracted ?? snippet
  const special = detectSpecialCode(status, body, extracted)

  if (special === "context_overflow") {
    return new ProviderError(`Context overflow: ${detail}`, {
      code: "context_overflow",
      status,
      providerId,
      retryable: false,
      responseBody: body.slice(0, 2000),
    })
  }
  if (special === "quota") {
    return new ProviderError(`Quota exceeded: ${detail}`, {
      code: "quota",
      status,
      providerId,
      retryable: false,
      responseBody: body.slice(0, 2000),
    })
  }
  if (special === "model_not_found") {
    return new ProviderError(`Model not found: ${detail}`, {
      code: "model_not_found",
      status,
      providerId,
      retryable: false,
      responseBody: body.slice(0, 2000),
    })
  }

  if (status === 401 || status === 403) {
    const gateway = /^\s*<!doctype|^\s*<html/i.test(body)
      ? " Request blocked by a gateway or proxy — key may be missing or expired."
      : ""
    return new ProviderError(`Authentication failed (${status}): ${detail}${gateway}`, {
      code: "auth",
      status,
      providerId,
      retryable: false,
      responseBody: body.slice(0, 2000),
    })
  }
  if (status === 429) {
    return new ProviderError(`Rate limited (${status}): ${detail}`, {
      code: "rate_limit",
      status,
      providerId,
      retryable: true,
      responseBody: body.slice(0, 2000),
    })
  }
  if (status === 400 || status === 422) {
    return new ProviderError(`Invalid request (${status}): ${detail}`, {
      code: "invalid_request",
      status,
      providerId,
      retryable: false,
      responseBody: body.slice(0, 2000),
    })
  }
  if (status >= 500) {
    return new ProviderError(`Provider server error (${status}): ${detail}`, {
      code: "server",
      status,
      providerId,
      retryable: true,
      responseBody: body.slice(0, 2000),
    })
  }
  return new ProviderError(`Unexpected response (${status}): ${detail}`, {
    code: "unknown",
    status,
    providerId,
    retryable: status === 404,
    responseBody: body.slice(0, 2000),
  })
}

export function toProviderError(err: unknown, providerId: string, timeoutMs?: number): ProviderError {
  if (err instanceof ProviderError) return err
  if (err instanceof Error && err.name === "AbortError") {
    return new ProviderError(
      timeoutMs !== undefined ? `Request timed out after ${timeoutMs}ms` : "Request timed out",
      { code: "timeout", providerId, cause: err }
    )
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.message.includes("timed out"))) {
    return new ProviderError(err.message, { code: "timeout", providerId, cause: err })
  }
  return new ProviderError(err instanceof Error ? err.message : "Network error", {
    code: "network",
    providerId,
    cause: err,
  })
}
