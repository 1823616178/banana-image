import { credentialsSchema } from '#server/dto/auth'
import { createSession, registerUser, toAuthUser } from '#server/services/auth'
import { setSessionCookie } from '#server/utils/auth'
import { checkLoginAttempt } from '#server/services/loginThrottle'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  checkLoginAttempt(`register:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`)
  const input = await readSchema(event, credentialsSchema)
  const user = await registerUser(input.username, input.password)
  setSessionCookie(event, await createSession(user.id))
  return toAuthUser(user)
}))
