import { listTemplates } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, () => listTemplates(requireUser(event))))
