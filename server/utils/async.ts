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

/** 将响应体读取放在 action 中，使超时覆盖整个请求，并关闭尚未完成的连接。 */
export async function withAbortableTimeout<T>(action: (signal: AbortSignal) => Promise<T>, timeoutMs: number, message = '操作超时'): Promise<T> {
  const controller = new AbortController()
  try {
    return await withTimeout(action(controller.signal), timeoutMs, message)
  } finally {
    controller.abort()
  }
}
