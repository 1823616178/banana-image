import { listUsers } from '#server/services/admin'
import { requireAdmin } from '#server/utils/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, () => {
  requireAdmin(event)
  return listUsers()
}))
