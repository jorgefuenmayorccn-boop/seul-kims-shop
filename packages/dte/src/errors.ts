export class DteError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'DteError'
  }
}

// Errores que se pueden reintentar (red, timeout, 5xx del proveedor)
export class DteRetryableError extends DteError {
  constructor(message: string, code?: string) {
    super(message, code)
    this.name = 'DteRetryableError'
  }
}

// Errores definitivos (RUT inválido, datos incorrectos, 4xx del proveedor)
export class DteFatalError extends DteError {
  constructor(message: string, code?: string) {
    super(message, code)
    this.name = 'DteFatalError'
  }
}
