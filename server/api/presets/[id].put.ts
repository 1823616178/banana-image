import { presetUpdateSchema } from '#server/dto/library'
import { updatePreset } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { idParam, readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  const id = idParam(getRouterParam(event, 'id'))
  return updatePreset(user, id, await readSchema(event, presetUpdateSchema))
}))
