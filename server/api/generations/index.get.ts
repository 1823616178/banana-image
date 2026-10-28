import { generationListSchema } from '#server/dto/generation'
import { listGenerations } from '#server/services/generation'
import { AppError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  const result = generationListSchema.safeParse(getQuery(event))
  if (!result.success) throw new AppError('VALIDATION_ERROR', '任务筛选参数不符合要求', 400)
  return listGenerations(result.data.status, result.data.page, result.data.size)
}))
