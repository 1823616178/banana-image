import { initializeDatabase } from '#server/db/data-source'
import { Setting } from '#server/db/entities/Setting'
import { getRedis } from '#server/services/redis'

const cacheKey = 'bi:cache:settings'

export async function getSettingsMap() {
  const redis = getRedis()
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as Record<string, unknown>
    }
  } catch {}

  const source = await initializeDatabase()
  const rows = await source.getRepository(Setting).find()
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]))
  try {
    if (redis.status === 'ready') await redis.set(cacheKey, JSON.stringify(settings), 'EX', 60)
  } catch {}
  return settings
}

export function settingValue<T>(settings: Record<string, unknown>, key: string, fallback: T): T {
  return settings[key] === undefined ? fallback : settings[key] as T
}

export async function writeSetting(key: string, value: unknown) {
  const source = await initializeDatabase()
  const repository = source.getRepository(Setting)
  const existing = await repository.findOneBy({ key })
  if (existing) {
    existing.value = value
    await repository.save(existing)
  } else {
    await repository.save(repository.create({ key, value }))
  }
  try {
    if (getRedis().status === 'ready') await getRedis().del(cacheKey)
  } catch {}
  return value
}
