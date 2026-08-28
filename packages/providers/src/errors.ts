export class ProviderError extends Error {
  readonly code: "timeout" | "rate_limit" | "auth" | "invalid_request" | "server" | "network" | "unknown"
  readonly status?: number
  readonly providerId: string
  readonly retryable: boolean

  constructor(
    message: string,
    opts: {
      code: ProviderError["code"]
      status?: number
      providerId: string
      retryable?: boolean
      cause?: unknown
    }
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = "ProviderError"
    this.code = opts.code
    this.status = opts.status
    this.providerId = opts.providerId
    this.retryable = opts.retryable ?? (opts.code === "timeout" || opts.code === "rate_limit" || opts.code === "server" || opts.code === "network")
  }
}

export function mapHttpError(status: number, body: string, providerId: string): ProviderError {
  const snippet = body.slice(0, 400)
  if (status === 401 || status === 403) {
    return new ProviderError(`Authentication failed (${status}): ${snippet}`, {
      code: "auth",
      status,
      providerId,
      retryable: false,
    })
  }
  if (status === 429) {
    return new ProviderError(`Rate limited (${status}): ${snippet}`, {
      code: "rate_limit",
      status,
      providerId,
      retryable: true,
    })
  }
  if (status === 400 || status === 422) {
    return new ProviderError(`Invalid request (${status}): ${snippet}`, {
      code: "invalid_request",
      status,
      providerId,
      retryable: false,
    })
  }
  if (status >= 500) {
    return new ProviderError(`Provider server error (${status}): ${snippet}`, {
      code: "server",
      status,
      providerId,
      retryable: true,
    })
  }
  return new ProviderError(`Unexpected response (${status}): ${snippet}`, {
    code: "unknown",
    status,
    providerId,
    retryable: false,
  })
}
