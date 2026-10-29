import { createHash } from 'node:crypto'
import { In, IsNull, Not } from 'typeorm'
import type { Repository } from 'typeorm'
import type { ImageDto, PageDto } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { createGeneration, toImageDto } from '#server/services/generation'
import { getRedis } from '#server/services/redis'
import { deleteStoredFiles } from '#server/services/storage'
import { AppError } from '#server/utils/errors'

export interface ImageListQuery {
  q?: string
  model?: string
  ratio?: string
  favorite?: boolean
  source?: 'generated' | 'upload'
  sort: 'newest' | 'oldest'
  page: number
  size: number
}

const CACHE_TTL = 60
const cachePrefix = (userId: string) => `bi:cache:gallery:${userId}:`

async function readCache<T>(key: string) {
  try {
    const redis = getRedis()
    if (redis.status !== 'ready') return null
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) as T : null
  } catch {
    return null
  }
}

async function writeCache(key: string, value: unknown) {
  try {
    const redis = getRedis()
    if (redis.status === 'ready') await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL)
  } catch {}
}

export async function clearUserGalleryCache(userId: string) {
  try {
    const redis = getRedis()
    if (redis.status !== 'ready') return
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${cachePrefix(userId)}*`, 'COUNT', 100)
      cursor = next
      if (keys.length) await redis.del(...keys)
    } while (cursor !== '0')
  } catch {}
}

/** 软删除的同哈希图片文件已清理，再次保存同一张图时先移除旧记录，避免唯一索引冲突。 */
export async function purgeDeletedDuplicate(repository: Repository<Image>, userId: string, sha256: string) {
  const deleted = await repository.findOne({ where: { userId, sha256, deletedAt: Not(IsNull()) }, withDeleted: true })
  if (deleted) await repository.delete({ id: deleted.id })
}

export async function listImages(userId: string, query: ImageListQuery): Promise<PageDto<ImageDto>> {
  const cacheKey = `${cachePrefix(userId)}${createHash('sha1').update(JSON.stringify(query)).digest('hex')}`
  const cached = await readCache<PageDto<ImageDto>>(cacheKey)
  if (cached) return cached

  const source = await initializeDatabase()
  const builder = source.getRepository(Image).createQueryBuilder('image')
    .leftJoin(Generation, 'generation', 'generation.id = image.generationId AND generation.userId = image.userId')
    .where('image.userId = :userId', { userId })
    .andWhere('image.source = :source', { source: query.source ?? 'generated' })
  if (query.favorite) builder.andWhere('image.isFavorite = 1')
  if (query.model) builder.andWhere('generation.model = :model', { model: query.model })
  if (query.ratio) builder.andWhere('generation.aspectRatio = :ratio', { ratio: query.ratio })
  if (query.q) builder.andWhere('generation.prompt LIKE :q', { q: `%${query.q.replace(/[\\%_]/g, char => `\\${char}`)}%` })
  builder.orderBy('image.createdAt', query.sort === 'oldest' ? 'ASC' : 'DESC').addOrderBy('image.id', query.sort === 'oldest' ? 'ASC' : 'DESC')
    .skip((query.page - 1) * query.size).take(query.size)
  const [images, total] = await builder.getManyAndCount()
  const generationIds = [...new Set(images.map(image => image.generationId).filter((id): id is string => Boolean(id)))]
  const generations = generationIds.length ? await source.getRepository(Generation).findBy({ id: In(generationIds), userId }) : []
  const byId = new Map(generations.map(item => [item.id, item]))
  const result = {
    items: images.map(image => toImageDto(image, image.generationId ? byId.get(image.generationId) : null)),
    total,
    page: query.page,
    size: query.size,
  }
  await writeCache(cacheKey, result)
  return result
}

async function findImage(id: string, userId: string) {
  const source = await initializeDatabase()
  const image = await source.getRepository(Image).findOneBy({ id, userId })
  if (!image) throw new AppError('IMAGE_NOT_FOUND', '作品不存在或已删除', 404)
  return image
}

export async function getImageDetail(id: string, userId: string) {
  const source = await initializeDatabase()
  const image = await findImage(id, userId)
  const generation = image.generationId ? await source.getRepository(Generation).findOneBy({ id: image.generationId, userId }) : null
  const references = generation?.refImageIds.length
    ? await source.getRepository(Image).findBy({ id: In(generation.refImageIds), userId })
    : []
  return {
    ...toImageDto(image, generation),
    finalPrompt: generation?.finalPrompt ?? null,
    count: generation?.count ?? null,
    mode: generation?.mode ?? null,
    costUsd: generation?.costUsd ?? null,
    durationMs: generation?.durationMs ?? null,
    stylePresetId: generation?.stylePresetId ?? null,
    references: references.map(item => toImageDto(item)),
  }
}

export async function setFavorite(id: string, userId: string, favorite: boolean) {
  const source = await initializeDatabase()
  const image = await findImage(id, userId)
  await source.getRepository(Image).update({ id: image.id, userId }, { isFavorite: favorite })
  await clearUserGalleryCache(userId)
  return { id, isFavorite: favorite }
}

export async function deleteImage(id: string, userId: string) {
  const source = await initializeDatabase()
  const image = await findImage(id, userId)
  await source.getRepository(Image).softDelete({ id: image.id, userId })
  await deleteStoredFiles([image.filePath, image.thumbPath], image.storage)
  await clearUserGalleryCache(userId)
  return { id }
}

export async function regenerateFromImage(id: string, userId: string) {
  const source = await initializeDatabase()
  const image = await findImage(id, userId)
  const generation = image.generationId ? await source.getRepository(Generation).findOneBy({ id: image.generationId, userId }) : null
  if (!generation) throw new AppError('GENERATION_NOT_FOUND', '这张图片没有可复用的生成参数', 400)
  const references = generation.refImageIds.length
    ? await source.getRepository(Image).findBy({ id: In(generation.refImageIds), userId })
    : []
  return createGeneration({
    userId,
    prompt: generation.prompt,
    model: generation.model,
    aspectRatio: generation.aspectRatio,
    imageSize: generation.imageSize,
    count: generation.count,
    refImageIds: references.map(item => item.id),
    stylePresetId: generation.stylePresetId,
    parentImageId: image.id,
  })
}

/** 图片文件只允许所属用户读取；未登记或已删除的文件一律按不存在处理。 */
export async function assertFileOwner(relativePath: string, userId: string) {
  const source = await initializeDatabase()
  const image = await source.getRepository(Image).createQueryBuilder('image')
    .select(['image.id', 'image.storage', 'image.filePath'])
    .where('image.userId = :userId', { userId })
    .andWhere('(image.filePath = :path OR image.thumbPath = :path)', { path: relativePath })
    .getOne()
  if (!image) throw new AppError('FILE_NOT_FOUND', '文件不存在', 404)
  return { storage: image.storage, isOriginal: image.filePath === relativePath }
}
