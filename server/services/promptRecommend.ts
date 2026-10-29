import type { PromptRecommendationDto } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { Image } from '#server/db/entities/Image'
import { getRedis } from '#server/services/redis'
import { recordDailyCost } from '#server/services/rateLimit'
import { readStoredImage } from '#server/services/storage'
import { describeImageWithVertex } from '#server/services/vertex'
import { RECOMMENDATION_INSTRUCTION, parseRecommendation } from '#server/services/promptRecommendParse'
import { AppError, logCaughtError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'

/**
 * 文本模型 token 单价（USD / 百万 tokens，Standard 档，≤200K 输入）。
 * 来源：https://cloud.google.com/vertex-ai/generative-ai/pricing ，核对日期 2026-10-29。
 * 输出价含 reasoning（思考）token。未列出的模型费用记为未知（null）。
 */
export const TEXT_MODEL_PRICES: Record<string, { inputPerMillion: number, outputPerMillion: number }> = {
  'gemini-3.1-flash-lite': { inputPerMillion: 0.25, outputPerMillion: 1.5 },
  'gemini-3.5-flash-lite': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  'gemini-3.5-flash': { inputPerMillion: 1.5, outputPerMillion: 9 },
  'gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  'gemini-2.5-flash-lite': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
}

export function textModelCost(model: string, inputTokens: number, outputTokens: number) {
  const price = TEXT_MODEL_PRICES[model]
  if (!price) return null
  return Number((inputTokens / 1e6 * price.inputPerMillion + outputTokens / 1e6 * price.outputPerMillion).toFixed(6))
}

/** 把 Vertex 的错误转换成具体的中文提示，并记录真实状态码与信息（不含凭据）。 */
export function toRecommendError(error: unknown, model: string) {
  if (error instanceof AppError && error.code !== 'TIMEOUT' && error.statusCode < 500) return error
  const status = Number((error as { status?: unknown })?.status ?? (error as { code?: unknown })?.code) || 0
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[prompt-recommend] Vertex 调用失败 model=${model} status=${status || 'n/a'} message=${message.slice(0, 600)}`)
  if (error instanceof AppError && error.code === 'VERTEX_NOT_CONFIGURED') return error
  if (/超时|timeout|timed out|ETIMEDOUT|DEADLINE/i.test(message) || status === 504) return new AppError('RECOMMEND_TIMEOUT', '提示词推荐超时，请稍后重试', 504)
  if (status === 404 || /NOT_FOUND|not found/i.test(message)) return new AppError('RECOMMEND_MODEL_UNAVAILABLE', `推荐模型 ${model} 在当前项目/区域不可用，请检查 PROMPT_RECOMMEND_MODEL`, 502)
  if (status === 401 || status === 403 || /PERMISSION_DENIED|UNAUTHENTICATED|credentials/i.test(message)) return new AppError('RECOMMEND_PERMISSION_DENIED', '没有调用推荐模型的权限，请检查 GCP 凭据与 Vertex AI API 是否启用', 502)
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) return new AppError('RECOMMEND_QUOTA', 'Vertex 配额不足或请求过多，请稍后重试', 429)
  if (status === 400 || /INVALID_ARGUMENT/i.test(message)) return new AppError('RECOMMEND_BAD_REQUEST', '推荐请求被 Vertex 拒绝（参数或图片格式不支持）', 502)
  return new AppError('RECOMMEND_FAILED', '提示词推荐服务暂时不可用，可先使用下方预设提示词', 502)
}

async function enforcePromptRate(userId: string, limit: number) {
  if (limit <= 0) return
  const key = `bi:rl:prompt:${userId}:${new Date().toISOString().slice(0, 16)}`
  const redis = getRedis()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 70)
  if (count > limit) throw new AppError('RATE_LIMITED', '提示词推荐太频繁，请稍后再试', 429)
}

async function recordUsage(model: string, inputTokens: number, outputTokens: number, costUsd: number) {
  const source = await initializeDatabase()
  await source.query(`
    INSERT INTO usage_stats (date, model, images, inputTokens, outputTokens, costUsd, createdAt, updatedAt)
    VALUES (UTC_DATE(), ?, 0, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      inputTokens = inputTokens + VALUES(inputTokens),
      outputTokens = outputTokens + VALUES(outputTokens),
      costUsd = costUsd + VALUES(costUsd),
      updatedAt = UTC_TIMESTAMP(3)`, [model, inputTokens, outputTokens, costUsd.toFixed(4)])
  await recordDailyCost(costUsd)
}

export async function recommendPrompts(userId: string, imageId: string): Promise<PromptRecommendationDto> {
  const config = getServerConfig().vertex
  const source = await initializeDatabase()
  const image = await source.getRepository(Image).findOneBy({ id: imageId, userId })
  if (!image) throw new AppError('IMAGE_NOT_FOUND', '参考图不存在或无权访问', 404)
  await enforcePromptRate(userId, config.promptRatePerMinute)

  const file = await readStoredImage(image.filePath, image.storage)
  let result: Awaited<ReturnType<typeof describeImageWithVertex>>
  try {
    result = await describeImageWithVertex({ model: config.promptModel, instruction: RECOMMENDATION_INSTRUCTION, image: { data: file.data, mimeType: image.mimeType } })
  } catch (error) {
    throw toRecommendError(error, config.promptModel)
  }

  const costUsd = textModelCost(config.promptModel, result.inputTokens, result.outputTokens)
  if (costUsd) await recordUsage(config.promptModel, result.inputTokens, result.outputTokens, costUsd).catch(error => logCaughtError('prompt-recommend-usage', error))

  const parsed = parseRecommendation(result.text)
  if (!parsed) throw new AppError('RECOMMEND_INVALID', '模型返回的推荐格式无效，请点击重新生成', 502)
  return { imageId, model: config.promptModel, ...parsed, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd }
}
