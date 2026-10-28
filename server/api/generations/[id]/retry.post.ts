import { retryGeneration } from '#server/services/generation'
import { respond } from '#server/utils/response'
import { idParam } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, () => retryGeneration(idParam(getRouterParam(event, 'id')))))
