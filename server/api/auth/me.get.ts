import { toAuthUser } from '#server/services/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, () => event.context.user ? toAuthUser(event.context.user) : null))
