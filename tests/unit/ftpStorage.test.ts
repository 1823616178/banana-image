import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const remote = new Map<string, Buffer>()
const ftpUpload = vi.fn(async (key: string, data: Buffer) => { remote.set(key, data) })
const ftpDownload = vi.fn(async (key: string) => {
  const data = remote.get(key)
  if (!data) throw Object.assign(new Error('missing'), { code: 'FTP_FILE_NOT_FOUND' })
  return data
})
const ftpRemove = vi.fn(async (key: string) => { remote.delete(key) })
vi.mock('#server/services/ftp', () => ({ ftpUpload, ftpDownload, ftpRemove }))

let dir = ''
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bi-ftp-'))
  Object.assign(process.env, { STORAGE_DIR: dir, FTP_HOST: 'ftp.test', FTP_USER: 'u', FTP_DIR: '/banana' })
})
afterAll(async () => {
  for (const key of ['STORAGE_DIR', 'FTP_HOST', 'FTP_USER', 'FTP_DIR', 'FTP_CACHE_MAX_MB']) delete process.env[key]
  await rm(dir, { recursive: true, force: true })
})
beforeEach(() => {
  remote.clear()
  vi.clearAllMocks()
  delete process.env.FTP_CACHE_MAX_MB
})

const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 10, b: 10 } } }).png().toBuffer()

describe('FTP 主存储', () => {
  it('保存时原图与缩略图都上传到 FTP，并标记 storage=ftp', async () => {
    const { saveImage } = await import('#server/services/storage')
    const stored = await saveImage(await png(), 'upload')
    expect(stored.storage).toBe('ftp')
    expect([...remote.keys()].sort()).toEqual([stored.filePath, stored.thumbPath].sort())
  })

  it('缩略图上传失败时回滚原图并抛错', async () => {
    const { saveImage } = await import('#server/services/storage')
    ftpUpload.mockImplementationOnce(async (key, data) => { remote.set(key, data) }).mockRejectedValueOnce(new Error('FTP_UNREACHABLE'))
    await expect(saveImage(await png(), 'upload')).rejects.toThrow('FTP_UNREACHABLE')
    expect(remote.size).toBe(0)
  })

  it('读取优先命中本地缓存，缓存关闭时从 FTP 下载', async () => {
    const { saveImage, readStoredImage } = await import('#server/services/storage')
    const stored = await saveImage(await png(), 'upload')
    const cached = await readStoredImage(stored.filePath, 'ftp')
    expect(ftpDownload).not.toHaveBeenCalled()
    process.env.FTP_CACHE_MAX_MB = '0'
    const fresh = await readStoredImage(stored.filePath, 'ftp')
    expect(ftpDownload).toHaveBeenCalledWith(stored.filePath)
    expect(fresh.data.equals(cached.data)).toBe(true)
    expect(fresh.extension).toBe('png')
  })

  it('删除时同时清理 FTP 与缓存', async () => {
    const { saveImage, deleteStoredFiles, readStoredImage } = await import('#server/services/storage')
    const stored = await saveImage(await png(), 'upload')
    await deleteStoredFiles([stored.filePath, stored.thumbPath], 'ftp')
    expect(remote.size).toBe(0)
    await expect(readStoredImage(stored.filePath, 'ftp')).rejects.toMatchObject({ code: 'FTP_FILE_NOT_FOUND' })
  })

  it('拒绝非法路径', async () => {
    const { readStoredImage } = await import('#server/services/storage')
    await expect(readStoredImage('../etc/passwd', 'ftp')).rejects.toMatchObject({ code: 'INVALID_FILE_PATH' })
  })

  it('缓存超出上限时淘汰最旧文件', async () => {
    const { saveImage, pruneCache } = await import('#server/services/storage')
    await saveImage(await png(), 'upload')
    expect(await pruneCache(0)).toBeGreaterThan(0)
  })
})
