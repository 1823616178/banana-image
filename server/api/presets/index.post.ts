import { presetInputSchema } from '#server/dto/library'
import { createPreset } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  return createPreset(user, await readSchema(event, presetInputSchema))
}))
