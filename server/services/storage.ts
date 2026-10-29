import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, realpath, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { ftpDownload, ftpRemove, ftpUpload } from '#server/services/ftp'
import { dirname, extname, resolve, sep } from 'node:path'
import sharp from 'sharp'
import { getServerConfig } from '#server/utils/config'
import { AppError } from '#server/utils/errors'

const allowedFormats = new Set(['jpeg', 'png', 'webp'])
const extensions: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }

/** 图片实际所在位置：ftp 为 FTP 主存储（FTP_DIR 下同名 key），local 为旧版本地 storage 目录 */
export type StorageBackend = 'local' | 'ftp'

export interface StoredImage {
  storage: StorageBackend
  filePath: string
  thumbPath: string
  mimeType: string
  width: number
  height: number
  bytes: number
  sha256: string
}

async function atomicWrite(path: string, data: Buffer) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = resolve(dirname(path), `.${randomUUID()}.uploading`)
  try {
    await writeFile(temporary, data, { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch(() => {})
  }
}

export function storagePath(relativePath: string) {
  if (!relativePath || relativePath.length > 512 || /[\\\0-\x1f]/.test(relativePath)) {
    throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
  }
  const segments = relativePath.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('%')) || !['images', 'thumbs', 'uploads'].includes(segments[0]!)) {
    throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
  }
  const root = getServerConfig().storageDir
  const path = resolve(root, ...segments)
  if (!path.startsWith(`${resolve(root)}${sep}`)) throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
  return path
}

export async function saveImage(buffer: Buffer, source: 'generated' | 'upload'): Promise<StoredImage> {
  const maxBytes = source === 'upload' ? 7 * 1024 * 1024 : 30 * 1024 * 1024
  if (!buffer.length || buffer.length > maxBytes) throw new AppError('INVALID_IMAGE_SIZE', `图片大小不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`, 400)

  const image = sharp(buffer, { limitInputPixels: 40_000_000, pages: 1, animated: false })
  const metadata = await image.metadata()
  if (!metadata.format || !allowedFormats.has(metadata.format)) throw new AppError('UNSUPPORTED_IMAGE', '仅支持 JPEG、PNG、WebP 图片', 400)
  if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000 || (metadata.pages ?? 1) > 1) {
    throw new AppError('INVALID_IMAGE_DIMENSIONS', '图片尺寸或页数不符合要求', 400)
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const now = new Date()
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const filename = randomUUID()
  const extension = extensions[metadata.format]!
  const directory = source === 'upload' ? 'uploads' : 'images'
  const filePath = `${directory}/${folder}/${filename}.${extension}`
  const thumbPath = `thumbs/${folder}/${filename}.webp`
  const root = getServerConfig().storageDir
  const thumbnail = await image.clone().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90, effort: 4 }).toBuffer()

  const storage: StorageBackend = getServerConfig().ftp.enabled ? 'ftp' : 'local'
  if (storage === 'ftp') {
    // FTP 为主存储：原图与缩略图都上传成功才算保存成功，本地只写缓存。
    await ftpUpload(filePath, buffer)
    try {
      await ftpUpload(thumbPath, thumbnail)
    } catch (error) {
      await ftpRemove(filePath).catch(() => {})
      throw error
    }
    await Promise.all([writeCache(filePath, buffer), writeCache(thumbPath, thumbnail)])
  } else {
    await atomicWrite(resolve(root, filePath), buffer)
    try {
      await atomicWrite(resolve(root, thumbPath), thumbnail)
    } catch (error) {
      await unlink(resolve(root, filePath)).catch(() => {})
      throw error
    }
  }

  return {
    storage,
    filePath,
    thumbPath,
    mimeType: metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`,
    width: metadata.width,
    height: metadata.height,
    bytes: buffer.length,
    sha256,
  }
}

async function readLocalImage(relativePath: string) {
  const path = storagePath(relativePath)
  const actualPath = await realpath(path)
  const root = await realpath(getServerConfig().storageDir)
  if (!actualPath.startsWith(`${root}${sep}`)) throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
  const info = await stat(actualPath)
  if (!info.isFile()) throw new AppError('FILE_NOT_FOUND', '文件不存在', 404)
  return await readFile(actualPath)
}

/** 读取图片：ftp 存储先查本地缓存，未命中再从 FTP 下载并写入缓存。 */
export async function readStoredImage(relativePath: string, storage: StorageBackend = 'local') {
  storagePath(relativePath)
  const extension = extname(relativePath).slice(1).toLowerCase()
  const data = storage === 'ftp' ? await readFtpImage(relativePath) : await readLocalImage(relativePath)
  return { data, bytes: data.length, extension }
}

async function readFtpImage(relativePath: string) {
  const cached = await readCache(relativePath)
  if (cached) return cached
  const data = await ftpDownload(relativePath)
  await writeCache(relativePath, data)
  return data
}

export async function deleteStoredFiles(paths: string[], storage: StorageBackend = 'local') {
  if (storage === 'ftp') {
    await Promise.all(paths.map(async (path) => {
      storagePath(path)
      await unlink(cachePath(path)).catch(() => {})
      await ftpRemove(path)
    }))
    return
  }
  await Promise.all(paths.map(path => unlink(storagePath(path)).catch(() => {})))
}

// ---- FTP 本地缓存：仅作加速，FTP 为唯一可信来源；按 FTP_CACHE_MAX_MB 限制总大小，超出按最久未访问淘汰 ----

function cacheRoot() {
  return resolve(getServerConfig().storageDir, '.ftp-cache')
}

function cachePath(relativePath: string) {
  storagePath(relativePath)
  return resolve(cacheRoot(), ...relativePath.split('/'))
}

async function readCache(relativePath: string) {
  if (getServerConfig().ftp.cacheMaxBytes <= 0) return null
  try {
    const path = cachePath(relativePath)
    const data = await readFile(path)
    const now = new Date()
    await utimes(path, now, now).catch(() => {})
    return data
  } catch {
    return null
  }
}

let writesSincePrune = 0

async function writeCache(relativePath: string, data: Buffer) {
  const maxBytes = getServerConfig().ftp.cacheMaxBytes
  if (maxBytes <= 0 || data.length > maxBytes) return
  try {
    await atomicWrite(cachePath(relativePath), data)
    writesSincePrune += 1
    if (writesSincePrune >= 20) {
      writesSincePrune = 0
      await pruneCache(maxBytes)
    }
  } catch {
    // 缓存写入失败不影响主流程
  }
}

async function listCacheFiles(directory: string): Promise<Array<{ path: string, size: number, mtimeMs: number }>> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return listCacheFiles(path)
    const info = await stat(path).catch(() => null)
    return info ? [{ path, size: info.size, mtimeMs: info.mtimeMs }] : []
  }))
  return files.flat()
}

export async function pruneCache(maxBytes = getServerConfig().ftp.cacheMaxBytes) {
  const files = (await listCacheFiles(cacheRoot())).sort((a, b) => b.mtimeMs - a.mtimeMs)
  let total = 0
  let removed = 0
  for (const file of files) {
    total += file.size
    if (total > maxBytes) {
      await unlink(file.path).catch(() => {})
      removed += 1
    }
  }
  return removed
}
