import type { ImageSize } from '#shared/types/api'

export interface ModelPricing {
  '1K'?: number
  '2K'?: number
  '4K'?: number
  inputPerMillion?: number
  outputPerMillion?: number
}

export type PricingTable = Record<string, ModelPricing>

export function estimateImageCost(model: string, imageSize: ImageSize, count: number, pricing: PricingTable) {
  const unit = pricing[model]?.[imageSize] ?? 0
  return Number((unit * count).toFixed(4))
}

export function calculateGenerationCost(input: {
  model: string
  imageSize: ImageSize
  imageCount: number
  inputTokens: number
  outputTokens: number
  pricing: PricingTable
}) {
  const modelPricing = input.pricing[input.model]
  const hasTokenPricing = typeof modelPricing?.inputPerMillion === 'number' && typeof modelPricing.outputPerMillion === 'number'
  if (hasTokenPricing && input.inputTokens + input.outputTokens > 0) {
    const cost = input.inputTokens / 1_000_000 * modelPricing.inputPerMillion! + input.outputTokens / 1_000_000 * modelPricing.outputPerMillion!
    return Number(cost.toFixed(4))
  }
  return estimateImageCost(input.model, input.imageSize, input.imageCount, input.pricing)
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}
