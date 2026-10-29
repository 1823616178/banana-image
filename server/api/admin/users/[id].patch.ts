import { adminUserUpdateSchema } from '#server/dto/auth'
import { updateUser } from '#server/services/admin'
import { requireAdmin } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { idParam, readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const admin = requireAdmin(event)
  const id = idParam(getRouterParam(event, 'id'))
  return updateUser(admin.id, id, await readSchema(event, adminUserUpdateSchema))
}))
