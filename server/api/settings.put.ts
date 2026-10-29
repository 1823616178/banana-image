import { settingsUpdateSchema } from '#server/dto/generation'
import { updateUserSettings } from '#server/services/userSettings'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  return updateUserSettings(user.id, await readSchema(event, settingsUpdateSchema), user.role)
}))
