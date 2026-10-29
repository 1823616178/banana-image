import { AppError } from '#server/utils/errors'

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number, resetAt: number }>()

/** 单进程内的登录/注册尝试限流：每个 IP+用户名 10 分钟内最多 10 次。 */
export function checkLoginAttempt(key: string, now = Date.now()) {
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (attempts.size > 10000) {
      for (const [item, value] of attempts) if (value.resetAt <= now) attempts.delete(item)
    }
    return
  }
  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) throw new AppError('TOO_MANY_ATTEMPTS', '尝试次数过多，请 10 分钟后再试', 429)
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key)
}
