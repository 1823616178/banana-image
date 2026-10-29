export class TimeoutError extends Error {
  readonly code = 'TIMEOUT'

  constructor(message = '操作超时') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message = '操作超时'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
