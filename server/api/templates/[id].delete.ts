import { deleteTemplate } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { idParam } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  return deleteTemplate(user, idParam(getRouterParam(event, 'id')))
}))
