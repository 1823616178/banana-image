import { changePasswordSchema } from '#server/dto/auth'
import { changePassword, SESSION_COOKIE } from '#server/services/auth'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  const input = await readSchema(event, changePasswordSchema)
  await changePassword(user.id, input.currentPassword, input.newPassword, getCookie(event, SESSION_COOKIE))
  return { ok: true }
}))
