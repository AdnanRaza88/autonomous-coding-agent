export type DeployErrorCode =
  | "bad_token"
  | "missing_token"
  | "build_error"
  | "not_found"
  | "unknown_target"
  | "unknown_run"
  | "detect_failed"
  | "network"
  | "timeout"
  | "invalid_project"
  | "quota"
  | "server"

export class DeployError extends Error {
  readonly code: DeployErrorCode
  readonly targetId?: string
  readonly status?: number

  constructor(opts: {
    message: string
    code: DeployErrorCode
    targetId?: string
    status?: number
    cause?: unknown
  }) {
    super(opts.message)
    this.name = "DeployError"
    this.code = opts.code
    this.targetId = opts.targetId
    this.status = opts.status
    if (opts.cause !== undefined) this.cause = opts.cause
  }
}

export function mapHostError(status: number, body: string, targetId: string): DeployError {
  const snippet = extractHostMessage(body) ?? body.slice(0, 400)
  if (status === 401 || status === 403) {
    return new DeployError({
      message: `Bad or missing token for ${targetId} (${status}): ${snippet}`,
      code: "bad_token",
      targetId,
      status,
    })
  }
  if (status === 404) {
    return new DeployError({
      message: `${targetId} resource not found: ${snippet}`,
      code: "not_found",
      targetId,
      status,
    })
  }
  if (status === 402 || /quota|payment required|insufficient/i.test(snippet)) {
    return new DeployError({
      message: `${targetId} quota exceeded: ${snippet}`,
      code: "quota",
      targetId,
      status,
    })
  }
  if (status === 400 || status === 422) {
    return new DeployError({
      message: `${targetId} rejected the project: ${snippet}`,
      code: "invalid_project",
      targetId,
      status,
    })
  }
  if (status >= 500) {
    return new DeployError({
      message: `${targetId} server error (${status}): ${snippet}`,
      code: "server",
      targetId,
      status,
    })
  }
  return new DeployError({
    message: `${targetId} request failed (${status}): ${snippet}`,
    code: "build_error",
    targetId,
    status,
  })
}

export function extractHostMessage(body: string): string | undefined {
  if (!body) return undefined
  if (/^\s*<!doctype|^\s*<html/i.test(body)) return undefined
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (typeof parsed.message === "string" && parsed.message) return parsed.message
    if (typeof parsed.error === "string" && parsed.error) return parsed.error
    if (parsed.error && typeof parsed.error === "object") {
      const err = parsed.error as Record<string, unknown>
      if (typeof err.message === "string") return err.message
    }
    if (typeof parsed.error_description === "string") return parsed.error_description
  } catch {
    return undefined
  }
  return undefined
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}
