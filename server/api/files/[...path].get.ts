import { readStoredImage } from '#server/services/storage'
import { AppError, errorMessage, logCaughtError } from '#server/utils/errors'

const mimeTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export default defineEventHandler(async (event) => {
  try {
    const raw = getRouterParam(event, 'path')
    if (!raw) throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
    const path = decodeURIComponent(raw)
    const file = await readStoredImage(path)
    setHeader(event, 'Content-Type', mimeTypes[file.extension] ?? 'application/octet-stream')
    setHeader(event, 'Content-Length', file.bytes)
    setHeader(event, 'Cache-Control', 'private, max-age=31536000, immutable')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return file.data
  } catch (error) {
    logCaughtError('files', error)
    const appError = error instanceof AppError ? error : new AppError('FILE_NOT_FOUND', '文件不存在或无法读取', 404)
    setResponseStatus(event, appError.statusCode)
    return { code: appError.code, message: appError.message || errorMessage(error) }
  }
})
