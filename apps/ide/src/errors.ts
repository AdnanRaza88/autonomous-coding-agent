export class IdeShellError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "IdeShellError"
    this.code = code
  }
}

export function isIdeShellError(err: unknown): err is IdeShellError {
  return err instanceof IdeShellError
}
