import { imageListSchema } from '#server/dto/generation'
import { listImages } from '#server/services/images'
import { requireUser } from '#server/utils/auth'
import { AppError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  const result = imageListSchema.safeParse(getQuery(event))
  if (!result.success) throw new AppError('VALIDATION_ERROR', '画廊筛选参数不符合要求', 400)
  return listImages(requireUser(event).id, result.data)
}))
