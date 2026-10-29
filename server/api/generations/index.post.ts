import { requireUser } from '#server/utils/auth'
import { createGenerationSchema } from '#server/dto/generation'
import { createGeneration } from '#server/services/generation'
import { respond } from '#server/utils/response'
import { readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const input = await readSchema(event, createGenerationSchema)
  return createGeneration({ ...input, userId: requireUser(event).id })
}))
