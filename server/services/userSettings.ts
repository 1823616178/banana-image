import { ASPECT_RATIOS, DEFAULT_MODELS, IMAGE_SIZES } from '#shared/config/models'
import type { ModelDefinition } from '#shared/config/models'
import type { GenerationDefaults, ImageSize, ModelDto, PricingDto, SettingsDto, UsageStatsDto, UserRole } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import type { PricingTable } from '#server/services/cost'
import { getSettingsMap, settingValue, writeSetting } from '#server/services/settings'
import { getServerConfig } from '#server/utils/config'
import { AppError } from '#server/utils/errors'

const userDefaultsKey = (userId: string) => `user:${userId}:defaults`

export async function listModels(): Promise<ModelDto[]> {
  const settings = await getSettingsMap()
  const configured = settingValue<ModelDefinition[] | string[]>(settings, 'models', DEFAULT_MODELS)
  const pricing = settingValue<PricingTable>(settings, 'pricing', {})
  const definitions = configured.map(item => typeof item === 'string'
    ? DEFAULT_MODELS.find(model => model.id === item) ?? { id: item, name: item, description: '', location: 'global' as const, maxReferenceImages: 14, prices: { '1K': 0, '2K': 0, '4K': 0 } }
    : item)
  for (const id of getServerConfig().vertex.models) {
    if (!definitions.some(item => item.id === id)) {
      definitions.push(DEFAULT_MODELS.find(model => model.id === id) ?? { id, name: id, description: '', location: 'global', maxReferenceImages: 14, prices: { '1K': 0, '2K': 0, '4K': 0 } })
    }
  }
  return definitions.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    maxReferenceImages: item.maxReferenceImages,
    prices: {
      '1K': Number(pricing[item.id]?.['1K'] ?? item.prices['1K'] ?? 0),
      '2K': Number(pricing[item.id]?.['2K'] ?? item.prices['2K'] ?? 0),
      '4K': Number(pricing[item.id]?.['4K'] ?? item.prices['4K'] ?? 0),
    },
  }))
}

function normalizeDefaults(value: Partial<GenerationDefaults> | undefined, modelIds: string[]): GenerationDefaults {
  const fallbackModel = modelIds[0] ?? DEFAULT_MODELS[0]!.id
  return {
    model: value?.model && modelIds.includes(value.model) ? value.model : fallbackModel,
    aspectRatio: value?.aspectRatio && (ASPECT_RATIOS as readonly string[]).includes(value.aspectRatio) ? value.aspectRatio : '1:1',
    imageSize: value?.imageSize && (IMAGE_SIZES as readonly string[]).includes(value.imageSize) ? value.imageSize : '1K',
    count: Number.isInteger(value?.count) && value!.count! >= 1 && value!.count! <= 4 ? value!.count! : 1,
  }
}

export async function getUserSettings(userId: string, role: UserRole = 'user'): Promise<SettingsDto> {
  const settings = await getSettingsMap()
  const modelIds = (await listModels()).map(item => item.id)
  const globalDefaults = settingValue<Partial<GenerationDefaults> | undefined>(settings, 'defaults', undefined)
  const userDefaults = settingValue<Partial<GenerationDefaults> | undefined>(settings, userDefaultsKey(userId), undefined)
  return {
    defaults: normalizeDefaults(userDefaults ?? globalDefaults, modelIds),
    dailyBudgetUsd: Number(settingValue(settings, 'dailyBudgetUsd', 0)) || 0,
    rateLimitPerMinute: Number(settingValue(settings, 'rateLimitPerMinute', 10)) || 0,
    creditGrantUsd: Number(settingValue(settings, 'creditGrantUsd', 0)) || 0,
    theme: settingValue<SettingsDto['theme']>(settings, 'theme', 'system'),
    allowRegistration: settingValue<boolean>(settings, 'allowRegistration', false) === true,
    registrationForcedByEnv: process.env.ALLOW_REGISTRATION === 'true',
    pricing: Object.fromEntries((await listModels()).map(item => [item.id, item.prices])),
    canManageShared: role === 'admin',
  }
}

export interface SettingsUpdate {
  defaults?: Partial<GenerationDefaults>
  dailyBudgetUsd?: number
  rateLimitPerMinute?: number
  creditGrantUsd?: number
  theme?: SettingsDto['theme']
  allowRegistration?: boolean
  pricing?: PricingDto
}

const SHARED_KEYS = ['dailyBudgetUsd', 'rateLimitPerMinute', 'creditGrantUsd', 'theme', 'allowRegistration', 'pricing'] as const

export async function updateUserSettings(userId: string, input: SettingsUpdate, role: UserRole = 'user') {
  if (role !== 'admin' && SHARED_KEYS.some(key => input[key] !== undefined)) {
    throw new AppError('FORBIDDEN', '共享限额、单价和注册开关只有管理员可以修改', 403)
  }
  if (input.defaults) {
    const current = await getUserSettings(userId, role)
    const modelIds = (await listModels()).map(item => item.id)
    await writeSetting(userDefaultsKey(userId), normalizeDefaults({ ...current.defaults, ...input.defaults }, modelIds))
  }
  if (input.dailyBudgetUsd !== undefined) await writeSetting('dailyBudgetUsd', input.dailyBudgetUsd)
  if (input.rateLimitPerMinute !== undefined) await writeSetting('rateLimitPerMinute', input.rateLimitPerMinute)
  if (input.creditGrantUsd !== undefined) await writeSetting('creditGrantUsd', input.creditGrantUsd)
  if (input.theme !== undefined) await writeSetting('theme', input.theme)
  if (input.allowRegistration !== undefined) await writeSetting('allowRegistration', input.allowRegistration)
  if (input.pricing !== undefined) {
    const known = new Set((await listModels()).map(item => item.id))
    const unknown = Object.keys(input.pricing).filter(id => !known.has(id))
    if (unknown.length) throw new AppError('MODEL_NOT_ALLOWED', `未知模型：${unknown.join(', ')}`, 400)
    const current = settingValue<PricingTable>(await getSettingsMap(), 'pricing', {})
    const next: PricingTable = { ...current }
    for (const [id, prices] of Object.entries(input.pricing)) {
      next[id] = { ...current[id] }
      for (const size of ['1K', '2K', '4K'] as ImageSize[]) {
        if (prices[size] !== undefined) next[id]![size] = prices[size]
      }
    }
    await writeSetting('pricing', next)
  }
  return getUserSettings(userId, role)
}

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function getUsageStats(userId: string, rangeDays: number): Promise<UsageStatsDto> {
  const source = await initializeDatabase()
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - rangeDays + 1))
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const queryStart = start < monthStart ? start : monthStart
  const rows: { day: string, model: string, images: string | number, cost: string | number }[] = await source.query(`
    SELECT DATE_FORMAT(g.createdAt, '%Y-%m-%d') AS day, g.model AS model,
      SUM(g.costUsd) AS cost,
      SUM((SELECT COUNT(*) FROM images i WHERE i.generationId = g.id AND i.userId = g.userId AND i.source = 'generated')) AS images
    FROM generations g
    WHERE g.userId = ? AND g.createdAt >= ?
    GROUP BY day, g.model
    ORDER BY day ASC
  `, [userId, queryStart])

  const startDay = utcDate(start)
  const today = utcDate(now)
  const month = today.slice(0, 7)
  const days = new Map<string, { images: number, costUsd: number }>()
  for (let index = 0; index < rangeDays; index += 1) {
    days.set(utcDate(new Date(start.getTime() + index * 86400000)), { images: 0, costUsd: 0 })
  }
  const byModel = new Map<string, { images: number, costUsd: number }>()
  let todayCost = 0
  let monthCost = 0
  for (const row of rows) {
    const images = Number(row.images) || 0
    const cost = Number(row.cost) || 0
    if (row.day === today) todayCost += cost
    if (row.day.startsWith(month)) monthCost += cost
    if (row.day < startDay) continue
    const day = days.get(row.day)
    if (day) {
      day.images += images
      day.costUsd += cost
    }
    const model = byModel.get(row.model) ?? { images: 0, costUsd: 0 }
    model.images += images
    model.costUsd += cost
    byModel.set(row.model, model)
  }
  const round = (value: number) => Number(value.toFixed(4))
  const dayList = [...days.entries()].map(([date, value]) => ({ date, images: value.images, costUsd: round(value.costUsd) }))
  return {
    rangeDays,
    totalImages: dayList.reduce((sum, item) => sum + item.images, 0),
    totalCostUsd: round(dayList.reduce((sum, item) => sum + item.costUsd, 0)),
    todayCostUsd: round(todayCost),
    monthCostUsd: round(monthCost),
    creditGrantUsd: Number(settingValue(await getSettingsMap(), 'creditGrantUsd', 0)) || 0,
    days: dayList,
    byModel: [...byModel.entries()].map(([model, value]) => ({ model, images: value.images, costUsd: round(value.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
  }
}
