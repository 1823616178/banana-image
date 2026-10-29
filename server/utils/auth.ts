import type { H3Event } from 'h3'
import type { User } from '#server/db/entities/User'
import { SESSION_COOKIE, SESSION_TTL_MS } from '#server/services/auth'
import { AppError } from '#server/utils/errors'

declare module 'h3' {
  interface H3EventContext {
    user?: User | null
  }
}

export function requireUser(event: H3Event) {
  const user = event.context.user
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401)
  return user
}

export function requireAdmin(event: H3Event) {
  const user = requireUser(event)
  if (user.role !== 'admin') throw new AppError('FORBIDDEN', '只有管理员可以执行此操作', 403)
  return user
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
