export class MemoryServiceError extends Error {
  readonly code: string
  readonly status?: number
  readonly service: "automem" | "graphiti" | "memory"

  constructor(opts: {
    message: string
    code: string
    service: "automem" | "graphiti" | "memory"
    status?: number
    cause?: unknown
  }) {
    super(opts.message)
    this.name = "MemoryServiceError"
    this.code = opts.code
    this.service = opts.service
    this.status = opts.status
    if (opts.cause !== undefined) this.cause = opts.cause
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}
