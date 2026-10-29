import { getImageDetail } from '#server/services/images'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { idParam } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, () => getImageDetail(idParam(getRouterParam(event, 'id')), requireUser(event).id)))
