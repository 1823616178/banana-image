import { z } from 'zod'
import { recommendPrompts } from '#server/services/promptRecommend'
import { requireUser } from '#server/utils/auth'
import { readSchema } from '#server/utils/validate'
import { respond } from '#server/utils/response'

const schema = z.object({ imageId: z.string().regex(/^[1-9]\d{0,19}$/) })

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  const body = await readSchema(event, schema)
  return recommendPrompts(user.id, body.imageId)
}))
