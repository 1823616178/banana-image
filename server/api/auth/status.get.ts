import { registrationOpen } from '#server/services/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => ({ registrationOpen: await registrationOpen() })))
