import { describe, expect, it } from 'vitest'
import { calculateGenerationCost, estimateImageCost, utcDay } from '#server/services/cost'

const pricing = {
  imageOnly: { '1K': 0.034, '2K': 0.05, '4K': 0.113 },
  tokens: { '1K': 0.04, inputPerMillion: 0.5, outputPerMillion: 30 },
}

describe('费用估算', () => {
  it('按张数乘单价，保留 4 位小数', () => {
    expect(estimateImageCost('imageOnly', '1K', 3, pricing)).toBe(0.102)
    expect(estimateImageCost('imageOnly', '4K', 4, pricing)).toBe(0.452)
  })

  it('未知模型或未标价分辨率按 0 计算', () => {
    expect(estimateImageCost('missing', '1K', 2, pricing)).toBe(0)
    expect(estimateImageCost('tokens', '4K', 2, pricing)).toBe(0)
  })

  it('有 token 单价且有用量时按 token 计费', () => {
    const cost = calculateGenerationCost({ model: 'tokens', imageSize: '1K', imageCount: 2, inputTokens: 1000, outputTokens: 2000, pricing })
    expect(cost).toBe(Number((1000 / 1e6 * 0.5 + 2000 / 1e6 * 30).toFixed(4)))
  })

  it('没有 token 用量或没有 token 单价时回落到按张计费', () => {
    expect(calculateGenerationCost({ model: 'tokens', imageSize: '1K', imageCount: 2, inputTokens: 0, outputTokens: 0, pricing })).toBe(0.08)
    expect(calculateGenerationCost({ model: 'imageOnly', imageSize: '2K', imageCount: 2, inputTokens: 500, outputTokens: 500, pricing })).toBe(0.1)
  })

  it('utcDay 输出 UTC 日期 YYYYMMDD', () => {
    expect(utcDay(new Date('2026-10-28T23:30:00+08:00'))).toBe('20261028')
    expect(utcDay(new Date('2026-10-29T08:00:00+08:00'))).toBe('20261029')
  })
})
