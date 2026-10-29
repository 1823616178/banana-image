import { getRedis } from '#server/services/redis'
import { utcDay } from '#server/services/cost'
import { AppError } from '#server/utils/errors'

function minuteKey(date = new Date()) {
  return date.toISOString().slice(0, 16).replaceAll(/[-:T]/g, '')
}

export async function enforceGenerationRate(userId: string, limitPerMinute: number) {
  if (limitPerMinute <= 0) return
  const key = `bi:rl:gen:${userId}:${minuteKey()}`
  const redis = getRedis()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 70)
  if (count > limitPerMinute) {
    throw new AppError('RATE_LIMITED', '当前分钟生成次数已达上限，请稍后再试', 429)
  }
}

export async function checkDailyBudget(limitUsd: number, estimatedCost: number) {
  if (limitUsd <= 0) return
  const key = `bi:cost:day:${utcDay()}`
  const current = Number(await getRedis().get(key) ?? 0)
  if (current + estimatedCost > limitUsd) {
    throw new AppError('DAILY_BUDGET_EXCEEDED', '本次预估费用会超出每日预算上限', 402)
  }
}

export async function recordDailyCost(costUsd: number) {
  if (costUsd <= 0) return
  const key = `bi:cost:day:${utcDay()}`
  const redis = getRedis()
  await redis.incrbyfloat(key, costUsd)
  await redis.expire(key, 172800)
}
