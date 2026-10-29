import { listModels } from '#server/services/userSettings'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, () => listModels()))
