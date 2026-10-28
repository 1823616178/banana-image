export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppError'
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function errorDetails(details: unknown) {
  try {
    return ` ${JSON.stringify(details)}`
  } catch {
    return ''
  }
}

export function logCaughtError(scope: string, error: unknown) {
  if (error instanceof AppError && error.statusCode < 500 && error.cause === undefined) {
    const details = error.details === undefined ? '' : errorDetails(error.details)
    console.warn(`[${scope}] ${error.statusCode} ${error.code}: ${error.message}${details}`)
    return
  }
  const prefix = error instanceof AppError ? `[${scope}] ${error.code}` : `[${scope}]`
  console.error(prefix, error)
}
