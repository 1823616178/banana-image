import { findSessionUser, SESSION_COOKIE } from '#server/services/auth'
import { logCaughtError } from '#server/utils/errors'

const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/status', '/api/auth/me', '/api/auth/logout', '/api/health'])

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/')) return
  const token = getCookie(event, SESSION_COOKIE)
  try {
    event.context.user = token ? await findSessionUser(token) : null
  } catch (error) {
    logCaughtError('auth', error)
    if (PUBLIC_API.has(path)) {
      event.context.user = null
      return
    }
    setResponseStatus(event, 503)
    return { code: 'AUTH_UNAVAILABLE', message: '数据库未连接，暂时无法校验登录状态' }
  }
  if (!event.context.user && !PUBLIC_API.has(path)) {
    setResponseStatus(event, 401)
    return { code: 'UNAUTHORIZED', message: '请先登录' }
  }
})
