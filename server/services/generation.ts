import { In } from 'typeorm'
import { DEFAULT_MODELS } from '#shared/config/models'
import type { ModelDefinition } from '#shared/config/models'
import type { AspectRatio, GenerationDto, GenerationStatus, ImageDto, ImageSize } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { findUsablePreset } from '#server/services/library'
import { estimateImageCost } from '#server/services/cost'
import type { PricingTable } from '#server/services/cost'
import { checkDailyBudget, enforceGenerationRate } from '#server/services/rateLimit'
import { getRedis } from '#server/services/redis'
import { getSettingsMap, settingValue } from '#server/services/settings'
import { resolveConfiguredModels, validateModelRequest } from '#server/services/modelCatalog'
import { AppError } from '#server/utils/errors'

// 队列版本不隔离数据库恢复扫描；升级必须先停止全部旧 worker（见 README）。
export const GENERATION_QUEUE = 'bi:queue:generation:v2'

export interface CreateGenerationInput {
  userId: string
  prompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  count: number
  refImageIds: string[]
  stylePresetId?: string | null
  parentImageId?: string | null
}

export function toImageDto(image: Image, generation?: Generation | null): ImageDto {
  const encodePath = (path: string) => `/api/files/${path.split('/').map(encodeURIComponent).join('/')}`
  return {
    id: image.id,
    generationId: image.generationId,
    source: image.source,
    url: encodePath(image.filePath),
    thumbUrl: encodePath(image.thumbPath),
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    isFavorite: image.isFavorite,
    prompt: generation?.prompt ?? null,
    model: generation?.model ?? null,
    aspectRatio: generation?.aspectRatio ?? null,
    imageSize: generation?.imageSize ?? null,
    createdAt: image.createdAt.toISOString(),
  }
}

export function toGenerationDto(generation: Generation, images: Image[]): GenerationDto {
  return {
    id: generation.id,
    prompt: generation.prompt,
    finalPrompt: generation.finalPrompt,
    model: generation.model,
    aspectRatio: generation.aspectRatio,
    imageSize: generation.imageSize,
    count: generation.count,
    mode: generation.mode,
    refImageIds: generation.refImageIds,
    stylePresetId: generation.stylePresetId,
    status: generation.status,
    errorCode: generation.errorCode,
    errorMessage: generation.errorMessage,
    inputTokens: generation.inputTokens,
    outputTokens: generation.outputTokens,
    costUsd: generation.costUsd,
    durationMs: generation.durationMs,
    parentImageId: generation.parentImageId,
    images: images.map(image => toImageDto(image, generation)),
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
  }
}

export async function findGeneration(id: string, userId: string) {
  const source = await initializeDatabase()
  const generation = await source.getRepository(Generation).findOneBy({ id, userId })
  if (!generation) throw new AppError('GENERATION_NOT_FOUND', '生成任务不存在', 404)
  return generation
}

export async function getGeneration(id: string, userId: string) {
  const source = await initializeDatabase()
  const generation = await findGeneration(id, userId)
  const images = await source.getRepository(Image).find({ where: { generationId: id, userId }, order: { createdAt: 'ASC' } })
  return toGenerationDto(generation, images)
}

export async function setTaskStatus(id: string, status: GenerationStatus, progress: number, error = '') {
  const redis = getRedis()
  const key = `bi:task:${id}`
  await redis.hset(key, { status, progress: String(progress), error })
  await redis.expire(key, 86400)
}

export async function enqueueGeneration(id: string) {
  await getRedis().lpush(GENERATION_QUEUE, JSON.stringify({ generationId: id }))
  await setTaskStatus(id, 'queued', 0)
}

export async function createGeneration(input: CreateGenerationInput) {
  const settings = await getSettingsMap()
  const configuredModels = settingValue<ModelDefinition[] | string[]>(settings, 'models', DEFAULT_MODELS)
  const model = resolveConfiguredModels(configuredModels).find(item => item.id === input.model)
  if (!model) throw new AppError('MODEL_NOT_ALLOWED', '所选模型不在可用列表中', 400)
  validateModelRequest(model, input)

  const source = await initializeDatabase()
  const references = input.refImageIds.length
    ? await source.getRepository(Image).findBy({ id: In(input.refImageIds), userId: input.userId })
    : []
  if (references.length !== input.refImageIds.length) throw new AppError('REFERENCE_NOT_FOUND', '部分参考图不存在或已删除', 400)

  let finalPrompt = input.prompt
  if (input.stylePresetId) {
    const preset = await findUsablePreset({ id: input.userId }, input.stylePresetId)
    if (!preset) throw new AppError('PRESET_NOT_FOUND', '风格预设不存在或已停用', 400)
    finalPrompt = `${input.prompt}\n${preset.promptSuffix}`
  }

  const pricing = settingValue<PricingTable>(settings, 'pricing', {})
  const estimated = estimateImageCost(input.model, input.imageSize, input.count, pricing)
  try {
    await enforceGenerationRate(input.userId, Number(settingValue(settings, 'rateLimitPerMinute', 10)))
    await checkDailyBudget(Number(settingValue(settings, 'dailyBudgetUsd', 0)), estimated)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('QUEUE_UNAVAILABLE', 'Redis 未连接，暂时无法提交生成任务', 503, undefined, { cause: error })
  }

  const generation = source.getRepository(Generation).create({
    userId: input.userId,
    prompt: input.prompt,
    finalPrompt,
    model: input.model,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    count: input.count,
    mode: references.length ? 'edit' : 'text2img',
    refImageIds: input.refImageIds,
    stylePresetId: input.stylePresetId ?? null,
    parentImageId: input.parentImageId ?? null,
    status: 'queued',
    costUsd: '0',
  })
  await source.getRepository(Generation).save(generation)

  try {
    await enqueueGeneration(generation.id)
  } catch (error) {
    await source.getRepository(Generation).update({ id: generation.id }, { status: 'failed', errorCode: 'QUEUE_UNAVAILABLE', errorMessage: '任务写入 Redis 队列失败' })
    throw new AppError('QUEUE_UNAVAILABLE', '任务写入队列失败，请检查 Redis 连接', 503, undefined, { cause: error })
  }
  return { id: generation.id }
}

export async function listGenerations(userId: string, status: GenerationStatus | undefined, page: number, size: number) {
  const source = await initializeDatabase()
  const [items, total] = await source.getRepository(Generation).findAndCount({
    where: status ? { userId, status } : { userId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * size,
    take: size,
  })
  const ids = items.map(item => item.id)
  const images = ids.length ? await source.getRepository(Image).findBy({ generationId: In(ids), userId }) : []
  return {
    items: items.map(item => toGenerationDto(item, images.filter(image => image.generationId === item.id))),
    total,
    page,
    size,
  }
}

export async function retryGeneration(id: string, userId: string) {
  const original = await findGeneration(id, userId)
  if (!['failed', 'partial', 'canceled'].includes(original.status)) {
    throw new AppError('GENERATION_NOT_RETRYABLE', '只有失败、部分成功或已取消的任务可以重试', 409)
  }
  return createGeneration({
    userId,
    prompt: original.prompt,
    model: original.model,
    aspectRatio: original.aspectRatio,
    imageSize: original.imageSize,
    count: original.count,
    refImageIds: original.refImageIds,
    stylePresetId: original.stylePresetId,
    parentImageId: original.parentImageId,
  })
}

export async function cancelGeneration(id: string, userId: string) {
  const generation = await findGeneration(id, userId)
  if (generation.status !== 'queued') throw new AppError('GENERATION_NOT_CANCELABLE', '只有排队中的任务可以取消', 409)
  const source = await initializeDatabase()
  await source.getRepository(Generation).update({ id, userId, status: 'queued' }, { status: 'canceled', cancelRequestedAt: new Date() })
  await getRedis().lrem(GENERATION_QUEUE, 0, JSON.stringify({ generationId: id }))
  await setTaskStatus(id, 'canceled', 0)
  return { id, status: 'canceled' as const }
}
