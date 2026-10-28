import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, realpath, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import sharp from 'sharp'
import { getServerConfig } from '#server/utils/config'
import { AppError } from '#server/utils/errors'

const allowedFormats = new Set(['jpeg', 'png', 'webp'])
const extensions: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }

export interface StoredImage {
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

  await atomicWrite(resolve(root, filePath), buffer)
  try {
    await atomicWrite(resolve(root, thumbPath), thumbnail)
  } catch (error) {
    await unlink(resolve(root, filePath)).catch(() => {})
    throw error
  }

  return {
    filePath,
    thumbPath,
    mimeType: metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`,
    width: metadata.width,
    height: metadata.height,
    bytes: buffer.length,
    sha256,
  }
}

export async function readStoredImage(relativePath: string) {
  const path = storagePath(relativePath)
  const actualPath = await realpath(path)
  const root = await realpath(getServerConfig().storageDir)
  if (!actualPath.startsWith(`${root}${sep}`)) throw new AppError('INVALID_FILE_PATH', '非法文件路径', 400)
  const info = await stat(actualPath)
  if (!info.isFile()) throw new AppError('FILE_NOT_FOUND', '文件不存在', 404)
  return { data: await readFile(actualPath), bytes: info.size, extension: extname(actualPath).slice(1).toLowerCase() }
}

export async function deleteStoredFiles(paths: string[]) {
  await Promise.all(paths.map(path => unlink(storagePath(path)).catch(() => {})))
}
