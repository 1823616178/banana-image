import { assertFileOwner } from '#server/services/images'
import { readStoredImage, storagePath } from '#server/services/storage'
import { requireUser } from '#server/utils/auth'
import { AppError, errorMessage, logCaughtError } from '#server/utils/errors'

const mimeTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/**
 * 图片代理：校验登录与归属后，从存储（FTP 主存储或旧的本地目录）读取并返回。
 * FTP 地址与凭据不会暴露给浏览器。?download=1 时以附件形式下载；支持单段 Range。
 */
export default defineEventHandler(async (event) => {
  try {
    const raw = getRouterParam(event, 'path')
    if (!raw) throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
    const path = decodeURIComponent(raw)
    storagePath(path)
    const owner = await assertFileOwner(path, requireUser(event).id)
    const file = await readStoredImage(path, owner.storage)
    const filename = path.split('/').pop()!
    setHeader(event, 'Content-Type', mimeTypes[file.extension] ?? 'application/octet-stream')
    setHeader(event, 'Cache-Control', 'private, max-age=31536000, immutable')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'ETag', `"${filename}"`)
    if (getQuery(event).download === '1') {
      setHeader(event, 'Content-Disposition', `attachment; filename="banana-image-${filename}"`)
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(getHeader(event, 'range') ?? '')
    if (range && (range[1] || range[2])) {
      const size = file.data.length
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      if (start >= size || start > end) {
        setResponseStatus(event, 416)
        setHeader(event, 'Content-Range', `bytes */${size}`)
        return ''
      }
      setResponseStatus(event, 206)
      setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
      setHeader(event, 'Content-Length', end - start + 1)
      return file.data.subarray(start, end + 1)
    }
    setHeader(event, 'Content-Length', file.bytes)
    return file.data
  } catch (error) {
    logCaughtError('files', error)
    const appError = error instanceof AppError ? error : new AppError('FILE_NOT_FOUND', '文件不存在或无法读取', 404)
    setResponseStatus(event, appError.statusCode)
    return { code: appError.code, message: appError.message || errorMessage(error) }
  }
})
