import { getUserSettings } from '#server/services/userSettings'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, () => getUserSettings(requireUser(event).id, requireUser(event).role)))
