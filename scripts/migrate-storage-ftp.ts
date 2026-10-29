/**
 * 把旧版本地 storage 目录中的图片（原图 + 缩略图）上传到 FTP 主存储，并把 images.storage 更新为 ftp。
 * 不删除本地文件；可重复执行（只处理 storage = local 的记录，含已软删除的记录不处理）。
 * 用法：npm run storage:migrate-ftp
 */
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const { initializeDatabase, dataSource } = await import('../server/db/data-source')
const { Image } = await import('../server/db/entities/Image')
const { ftpUpload, closeFtpPool, checkFtpConnection } = await import('../server/services/ftp')
const { readStoredImage } = await import('../server/services/storage')
const { getServerConfig } = await import('../server/utils/config')

if (!getServerConfig().ftp.enabled) {
  console.error('未启用 FTP（FTP_HOST 为空或 FTP_ENABLED=false），已退出')
  process.exit(1)
}
await checkFtpConnection()
const source = await initializeDatabase()
const repository = source.getRepository(Image)
const records = await repository.find({ where: { storage: 'local' }, order: { id: 'ASC' } })
let migrated = 0
let missing = 0
let failed = 0
for (const record of records) {
  try {
    for (const key of [record.filePath, record.thumbPath]) {
      const file = await readStoredImage(key, 'local')
      await ftpUpload(key, file.data)
    }
    await repository.update({ id: record.id }, { storage: 'ftp' })
    migrated += 1
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'ENOENT' || code === 'FILE_NOT_FOUND') missing += 1
    else failed += 1
    console.warn(`图片 ${record.id} 迁移失败：${code ?? ''} ${(error as Error).message}`)
  }
}
console.info(`待迁移 ${records.length} 条，成功 ${migrated}，本地文件缺失 ${missing}，其他失败 ${failed}`)
closeFtpPool()
await dataSource.destroy()
