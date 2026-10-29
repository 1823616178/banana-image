import { libraryListSchema } from '#server/dto/library'
import { listPresets } from '#server/services/library'
import { requireUser } from '#server/utils/auth'
import { AppError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  const query = libraryListSchema.safeParse(getQuery(event))
  if (!query.success) throw new AppError('VALIDATION_ERROR', '查询参数不符合要求', 400)
  return listPresets(requireUser(event), Boolean(query.data.manage))
}))
