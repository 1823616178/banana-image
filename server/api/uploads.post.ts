import { purgeDeletedDuplicate } from '#server/services/images'
import { requireUser } from '#server/utils/auth'
import { initializeDatabase } from '#server/db/data-source'
import { Image } from '#server/db/entities/Image'
import { toImageDto } from '#server/services/generation'
import { deleteStoredFiles, saveImage } from '#server/services/storage'
import { AppError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  const fields = await readMultipartFormData(event)
  const file = fields?.find(field => field.name === 'file' || field.name === 'image')
  if (!file?.data.length) throw new AppError('UPLOAD_REQUIRED', '请选择要上传的图片', 400)
  if (file.data.length > 7 * 1024 * 1024) throw new AppError('UPLOAD_TOO_LARGE', '单张参考图不能超过 7MB', 400)

  const stored = await saveImage(file.data, 'upload')
  try {
    const source = await initializeDatabase()
    const repository = source.getRepository(Image)
    const existing = await repository.findOneBy({ userId: user.id, sha256: stored.sha256 })
    if (existing) {
      await deleteStoredFiles([stored.filePath, stored.thumbPath], stored.storage)
      return toImageDto(existing)
    }
    await purgeDeletedDuplicate(repository, user.id, stored.sha256)
    const image = repository.create({ ...stored, userId: user.id, generationId: null, source: 'upload', isFavorite: false })
    return toImageDto(await repository.save(image))
  } catch (error) {
    await deleteStoredFiles([stored.filePath, stored.thumbPath], stored.storage)
    throw error
  }
}))
