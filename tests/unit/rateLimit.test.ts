import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, number>()
const expires = new Map<string, number>()
const fakeRedis = {
  incr: vi.fn(async (key: string) => {
    store.set(key, (store.get(key) ?? 0) + 1)
    return store.get(key)!
  }),
  expire: vi.fn(async (key: string, seconds: number) => {
    expires.set(key, seconds)
    return 1
  }),
  get: vi.fn(async (key: string) => store.has(key) ? String(store.get(key)) : null),
  incrbyfloat: vi.fn(async (key: string, value: number) => {
    store.set(key, (store.get(key) ?? 0) + value)
    return String(store.get(key))
  }),
}

vi.mock('#server/services/redis', () => ({ getRedis: () => fakeRedis }))

const { checkDailyBudget, enforceGenerationRate, recordDailyCost } = await import('#server/services/rateLimit')

describe('生成限流', () => {
  beforeEach(() => {
    store.clear()
    expires.clear()
    vi.clearAllMocks()
  })

  it('每个用户每分钟独立计数，超过上限返回 429', async () => {
    for (let index = 0; index < 3; index += 1) await enforceGenerationRate('1', 3)
    await expect(enforceGenerationRate('1', 3)).rejects.toMatchObject({ code: 'RATE_LIMITED', statusCode: 429 })
    await expect(enforceGenerationRate('2', 3)).resolves.toBeUndefined()
    const keys = [...store.keys()]
    expect(keys.some(key => key.startsWith('bi:rl:gen:1:'))).toBe(true)
    expect(keys.some(key => key.startsWith('bi:rl:gen:2:'))).toBe(true)
  })

  it('首次计数时设置 70 秒过期', async () => {
    await enforceGenerationRate('1', 5)
    await enforceGenerationRate('1', 5)
    expect(fakeRedis.expire).toHaveBeenCalledTimes(1)
    expect([...expires.values()]).toEqual([70])
  })

  it('上限为 0 表示不限，不访问 Redis', async () => {
    await enforceGenerationRate('1', 0)
    expect(fakeRedis.incr).not.toHaveBeenCalled()
  })
})

describe('每日预算', () => {
  beforeEach(() => store.clear())

  it('累计费用加本次预估超过预算时返回 402', async () => {
    await recordDailyCost(0.9)
    await expect(checkDailyBudget(1, 0.05)).resolves.toBeUndefined()
    await expect(checkDailyBudget(1, 0.2)).rejects.toMatchObject({ code: 'DAILY_BUDGET_EXCEEDED', statusCode: 402 })
  })

  it('预算为 0 不限制，费用为 0 不记录', async () => {
    await expect(checkDailyBudget(0, 999)).resolves.toBeUndefined()
    await recordDailyCost(0)
    expect(store.size).toBe(0)
  })
})
