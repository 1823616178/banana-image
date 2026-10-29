import { usageQuerySchema } from '#server/dto/generation'
import { getUsageStats } from '#server/services/userSettings'
import { requireUser } from '#server/utils/auth'
import { AppError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  const result = usageQuerySchema.safeParse(getQuery(event))
  if (!result.success) throw new AppError('VALIDATION_ERROR', '统计范围只支持 7d、30d、90d', 400)
  return getUsageStats(requireUser(event).id, Number.parseInt(result.data.range, 10))
}))
