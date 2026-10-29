import { loginSchema } from '#server/dto/auth'
import { authenticate, createSession, toAuthUser } from '#server/services/auth'
import { checkLoginAttempt, clearLoginAttempts } from '#server/services/loginThrottle'
import { setSessionCookie } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const input = await readSchema(event, loginSchema)
  const key = `login:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}:${input.username.toLowerCase()}`
  checkLoginAttempt(key)
  const user = await authenticate(input.username, input.password)
  clearLoginAttempts(key)
  setSessionCookie(event, await createSession(user.id))
  return toAuthUser(user)
}))
