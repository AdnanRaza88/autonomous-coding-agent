export class DeploySecurityError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string) {
    super(message)
    this.name = "DeploySecurityError"
    this.code = code
    this.path = path
  }
}

export function blocked(message: string, path?: string): DeploySecurityError {
  return new DeploySecurityError("blocked", message, path)
}

export function cryptoFail(message: string): DeploySecurityError {
  return new DeploySecurityError("crypto", message)
}

export function storeFail(message: string): DeploySecurityError {
  return new DeploySecurityError("store", message)
}
