import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODELS } from '#shared/config/models'
import { resolveConfiguredModels } from '#server/services/modelCatalog'
import { listModels, getUserSettings } from '#server/services/userSettings'
import { createGeneration } from '#server/services/generation'
import { getSettingsMap } from '#server/services/settings'
import { initializeDatabase } from '#server/db/data-source'
import { checkDailyBudget, enforceGenerationRate } from '#server/services/rateLimit'

vi.mock('#server/db/data-source', () => ({ initializeDatabase: vi.fn() }))
vi.mock('#server/services/settings', () => ({
  getSettingsMap: vi.fn(),
  settingValue: (settings: Record<string, unknown>, key: string, fallback: unknown) => settings[key] === undefined ? fallback : settings[key],
  writeSetting: vi.fn(),
}))
vi.mock('#server/services/rateLimit', () => ({ checkDailyBudget: vi.fn(), enforceGenerationRate: vi.fn() }))

const input = { userId: '1', prompt: 'a cat', model: 'sensenova-u1.5-lite', aspectRatio: '1:1', imageSize: '2K', count: 1, refImageIds: [] } as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SENSENOVA_API_KEY', '')
  vi.stubEnv('COPILOT_BASE_URL', '')
  vi.mocked(getSettingsMap).mockResolvedValue({})
})

afterEach(() => vi.unstubAllEnvs())

describe('模型目录与可用性', () => {
  it('缺少密钥时过滤数据库和环境变量中的商汤模型', async () => {
    vi.mocked(getSettingsMap).mockResolvedValue({ models: DEFAULT_MODELS })
    const models = await listModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models.every(model => model.provider === 'vertex')).toBe(true)
  })

  it('配置密钥后暴露商汤模型的实际能力', async () => {
    vi.stubEnv('SENSENOVA_API_KEY', 'test-key')
    const models = await listModels()
    expect(models.find(model => model.id === input.model)).toMatchObject({ provider: 'sensenova', maxReferenceImages: 5, supportedImageSizes: ['1K', '2K', '4K'] })
    expect(models.find(model => model.id === input.model)!.supportedAspectRatios).not.toContain('8:1')
  })

  it('自定义模型别名使用配置的 provider', () => {
    const catalog = resolveConfiguredModels([{ ...DEFAULT_MODELS[0]!, id: 'studio-u1', provider: 'sensenova' }])
    expect(catalog.find(model => model.id === 'studio-u1')).toMatchObject({ provider: 'sensenova', enabled: false, maxReferenceImages: 0 })
  })

  it('SENSENOVA_MODELS 中的自定义 ID 不依赖名称猜测供应商', async () => {
    vi.stubEnv('SENSENOVA_MODELS', 'studio-u1')
    expect(resolveConfiguredModels([]).find(model => model.id === 'studio-u1')).toMatchObject({ provider: 'sensenova', enabled: false })
    vi.stubEnv('SENSENOVA_API_KEY', 'test-key')
    expect((await listModels()).find(model => model.id === 'studio-u1')).toMatchObject({ provider: 'sensenova', maxReferenceImages: 0 })
  })

  it('旧设置的极端比例默认值自动回落到支持的选项', async () => {
    vi.stubEnv('SENSENOVA_API_KEY', 'test-key')
    vi.mocked(getSettingsMap).mockResolvedValue({ defaults: { model: input.model, aspectRatio: '8:1', imageSize: '4K' } })
    expect((await getUserSettings('1')).defaults).toMatchObject({ model: input.model, aspectRatio: '1:1', imageSize: '4K' })
  })
})

describe('入队前校验', () => {
  it.each([
    [{}, '', 'SENSENOVA_NOT_CONFIGURED'],
    [{ aspectRatio: '8:1' }, 'test-key', 'UNSUPPORTED_ASPECT_RATIO'],
    [{ refImageIds: ['1', '2', '3', '4', '5', '6'] }, 'test-key', 'TOO_MANY_REFERENCES'],
    [{ model: 'unknown-model' }, 'test-key', 'MODEL_NOT_ALLOWED'],
  ] as const)('拒绝无效请求，且不消耗频率或预算（%#）', async (overrides, key, code) => {
    vi.stubEnv('SENSENOVA_API_KEY', key)
    await expect(createGeneration({ ...input, ...overrides, refImageIds: [...('refImageIds' in overrides ? overrides.refImageIds : input.refImageIds)] })).rejects.toMatchObject({ code })
    expect(initializeDatabase).not.toHaveBeenCalled()
    expect(enforceGenerationRate).not.toHaveBeenCalled()
    expect(checkDailyBudget).not.toHaveBeenCalled()
  })
})
