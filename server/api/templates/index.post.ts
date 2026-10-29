import { templateInputSchema } from '#server/dto/library'
import { createTemplate } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  return createTemplate(user, await readSchema(event, templateInputSchema))
}))
