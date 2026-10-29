import { requireUser } from '#server/utils/auth'
import { cancelGeneration } from '#server/services/generation'
import { respond } from '#server/utils/response'
import { idParam } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, () => cancelGeneration(idParam(getRouterParam(event, 'id')), requireUser(event).id)))
