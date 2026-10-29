import { destroySession, SESSION_COOKIE } from '#server/services/auth'
import { clearSessionCookie } from '#server/utils/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  await destroySession(getCookie(event, SESSION_COOKIE))
  clearSessionCookie(event)
  return { ok: true }
}))
