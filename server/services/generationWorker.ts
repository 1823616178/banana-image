import { In, LessThanOrEqual, Or, IsNull } from 'typeorm'
import { initializeDatabase } from '#server/db/data-source'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { calculateGenerationCost, utcDay } from '#server/services/cost'
import type { PricingTable } from '#server/services/cost'
import { classifyGenerationError, noImageError, retryDelayMs, shouldRetry } from '#server/services/generationErrors'
import { GENERATION_QUEUE, setTaskStatus } from '#server/services/generation'
import { purgeDeletedDuplicate } from '#server/services/images'
import { recordDailyCost } from '#server/services/rateLimit'
import { getRedis } from '#server/services/redis'
import { getSettingsMap, settingValue } from '#server/services/settings'
import { deleteStoredFiles, readStoredImage, saveImage } from '#server/services/storage'
import { generateWithVertex } from '#server/services/vertex'
import { AppError, logCaughtError } from '#server/utils/errors'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function loadReferences(generation: Generation) {
  if (!generation.refImageIds.length) return []
  const source = await initializeDatabase()
  const records = await source.getRepository(Image).findBy({ id: In(generation.refImageIds), userId: generation.userId ?? IsNull() })
  const byId = new Map(records.map(record => [record.id, record]))
  return Promise.all(generation.refImageIds.map(async (id) => {
    const record = byId.get(id)
    if (!record) throw new AppError('REFERENCE_NOT_FOUND', `参考图 ${id} 不存在或已删除`, 400)
    const file = await readStoredImage(record.filePath)
    return { data: file.data, mimeType: record.mimeType }
  }))
}

async function persistGeneratedImage(generation: Generation, data: Buffer, index: number) {
  const source = await initializeDatabase()
  const stored = await saveImage(data, 'generated')
  const repository = source.getRepository(Image)
  const existing = await repository.findOneBy({ userId: generation.userId ?? IsNull(), sha256: stored.sha256 })
  if (existing) {
    await deleteStoredFiles([stored.filePath, stored.thumbPath])
    if (existing.generationId === generation.id) return existing
    throw new AppError('DUPLICATE_IMAGE', `第 ${index + 1} 张图片与已有作品重复`, 409)
  }
  if (generation.userId) await purgeDeletedDuplicate(repository, generation.userId, stored.sha256)
  const image = repository.create({
    ...stored,
    userId: generation.userId,
    generationId: generation.id,
    source: 'generated',
    isFavorite: false,
  })
  try {
    return await repository.save(image)
  } catch (error) {
    await deleteStoredFiles([stored.filePath, stored.thumbPath])
    throw error
  }
}

async function clearGalleryCache() {
  const redis = getRedis()
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'bi:cache:gallery:*', 'COUNT', 100)
    cursor = next
    if (keys.length) await redis.del(...keys)
  } while (cursor !== '0')
}

async function recordUsage(generation: Generation, images: number, inputTokens: number, outputTokens: number, costUsd: number) {
  if (!images) return
  const source = await initializeDatabase()
  const day = `${utcDay().slice(0, 4)}-${utcDay().slice(4, 6)}-${utcDay().slice(6, 8)}`
  await source.query(`
    INSERT INTO usage_stats (date, model, images, inputTokens, outputTokens, costUsd, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      images = images + VALUES(images),
      inputTokens = inputTokens + VALUES(inputTokens),
      outputTokens = outputTokens + VALUES(outputTokens),
      costUsd = costUsd + VALUES(costUsd),
      updatedAt = UTC_TIMESTAMP(3)
  `, [day, generation.model, images, inputTokens, outputTokens, costUsd])
}

export async function processGeneration(id: string) {
  const source = await initializeDatabase()
  const generation = await source.getRepository(Generation).findOneBy({ id })
  if (!generation || generation.status !== 'running') return

  const startedAt = Date.now()
  const references = await loadReferences(generation)

  const outcomes = await Promise.allSettled(Array.from({ length: generation.count }, async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await generateWithVertex({
          prompt: generation.finalPrompt,
          model: generation.model,
          aspectRatio: generation.aspectRatio,
          imageSize: generation.imageSize,
          referenceImages: references,
        })
        if (!result.images.length) throw noImageError(result.finishReasons, result.text)
        return result
      } catch (error) {
        const classified = classifyGenerationError(error)
        const retryable = shouldRetry(classified, attempt)
        if (!retryable) throw new AppError(classified.code, classified.message, 502, undefined, { cause: error })
        logCaughtError(`worker generation ${generation.id} attempt ${attempt + 1} retrying`, error)
        await delay(retryDelayMs(attempt))
      }
    }
  }))

  const savedImages: Image[] = []
  const errors: string[] = []
  let inputTokens = 0
  let outputTokens = 0
  let blocked = false

  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.status === 'rejected') {
      logCaughtError(`worker generation ${id} image ${index + 1}`, outcome.reason)
      const classified = classifyGenerationError(outcome.reason)
      errors.push(`第 ${index + 1} 张：${classified.message}`)
      blocked ||= classified.blocked
      continue
    }
    inputTokens += outcome.value.inputTokens
    outputTokens += outcome.value.outputTokens
    try {
      savedImages.push(await persistGeneratedImage(generation, outcome.value.images[0]!.data, index))
      await setTaskStatus(id, 'running', Math.round((index + 1) / generation.count * 100))
    } catch (error) {
      logCaughtError(`worker generation ${id} image ${index + 1} save`, error)
      errors.push(`第 ${index + 1} 张保存失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const settings = await getSettingsMap()
  const pricing = settingValue<PricingTable>(settings, 'pricing', {})
  const costUsd = calculateGenerationCost({ model: generation.model, imageSize: generation.imageSize, imageCount: savedImages.length, inputTokens, outputTokens, pricing })
  const status = savedImages.length === generation.count ? 'succeeded' : savedImages.length ? 'partial' : blocked ? 'blocked' : 'failed'
  const errorMessage = [...new Set(errors)].join('\n').slice(0, 4000) || null
  const durationMs = Date.now() - startedAt

  await source.getRepository(Generation).update({ id }, {
    status,
    errorCode: errors.length ? status === 'blocked' ? 'CONTENT_BLOCKED' : 'GENERATION_INCOMPLETE' : null,
    errorMessage,
    inputTokens,
    outputTokens,
    costUsd: costUsd.toFixed(4),
    durationMs,
    workerId: null,
    lockedAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
  })
  await setTaskStatus(id, status, 100, errorMessage ?? '')
  await recordUsage(generation, savedImages.length, inputTokens, outputTokens, costUsd).catch((error) => {
    logCaughtError(`worker generation ${id} usage`, error)
  })
  const sideEffects = await Promise.allSettled([recordDailyCost(costUsd), clearGalleryCache()])
  for (const result of sideEffects) {
    if (result.status === 'rejected') logCaughtError(`worker generation ${id}`, result.reason)
  }
  return status
}

export async function recoverGenerationQueue() {
  const source = await initializeDatabase()
  const repository = source.getRepository(Generation)
  await repository.update({ status: 'running', leaseExpiresAt: Or(IsNull(), LessThanOrEqual(new Date())) }, {
    status: 'queued',
    workerId: null,
    lockedAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
  })
  const queued = await repository.find({ select: { id: true }, where: { status: 'queued' }, order: { createdAt: 'DESC' }, take: 10_000 })
  const redis = getRedis()
  const entries = await redis.lrange(GENERATION_QUEUE, 0, -1)
  const existing = new Set(entries.map((entry) => {
    try { return String(JSON.parse(entry).generationId) } catch { return entry }
  }))
  for (const generation of queued) {
    if (!existing.has(generation.id)) await redis.lpush(GENERATION_QUEUE, JSON.stringify({ generationId: generation.id }))
    await setTaskStatus(generation.id, 'queued', 0)
  }
}
