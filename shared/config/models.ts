import type { AspectRatio, ImageSize, ModelProvider } from '../types/api'
import { SENSENOVA_ASPECT_RATIOS, SENSENOVA_IMAGE_SIZES, SENSENOVA_MAX_REFERENCE_IMAGES } from './sensenova'
import { COPILOT_ASPECT_RATIOS, COPILOT_IMAGE_SIZES, COPILOT_MAX_REFERENCE_IMAGES } from './copilot'

export const ASPECT_RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'] as const satisfies readonly AspectRatio[]
export const IMAGE_SIZES = ['1K', '2K', '4K'] as const satisfies readonly ImageSize[]

/** 单价为 null 表示官方价格页未列出该分辨率（待确认），不参与预估。 */
export type SizePrices = Record<ImageSize, number | null>

export interface TokenPrices {
  /** 输入（文本/图片）每百万 token 美元 */
  inputPerMillion: number
  /** 文本输出（含推理）每百万 token 美元 */
  textOutputPerMillion: number
  /** 图片输出每百万 token 美元 */
  imageOutputPerMillion: number
}

export interface ModelDefinition {
  id: string
  name: string
  description: string
  provider?: ModelProvider
  location?: 'global'
  maxReferenceImages: number
  prices: SizePrices
  tokenPrices?: TokenPrices | null
  priceSource?: string
  priceCheckedAt?: string
}

/**
 * 官方价格来源：Vertex AI 生成式 AI 定价页（Standard 档、Global 区域），核对日期 2026-10-29。
 * https://cloud.google.com/vertex-ai/generative-ai/pricing
 * 每张图价格取自官方脚注中“按分辨率折算的输出图片费用”；页面未列出的分辨率记为 null（待确认）。
 */
export const PRICE_SOURCE_URL = 'https://cloud.google.com/vertex-ai/generative-ai/pricing'
export const PRICE_CHECKED_AT = '2026-10-29'

export const DEFAULT_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-nano-banana-2.1',
    name: 'Nano Banana 2.1',
    description: '默认主力模型，支持多轮编辑',
    location: 'global',
    maxReferenceImages: 14,
    // 官方脚注 [4]：1K 1120 tokens ($0.034)，2K 1680 tokens ($0.05)，4K 3780 tokens ($0.113)
    prices: { '1K': 0.034, '2K': 0.05, '4K': 0.113 },
    tokenPrices: { inputPerMillion: 1.5, textOutputPerMillion: 7.5, imageOutputPerMillion: 30 },
    priceSource: PRICE_SOURCE_URL,
    priceCheckedAt: PRICE_CHECKED_AT,
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: '复杂构图与文字渲染',
    location: 'global',
    maxReferenceImages: 14,
    // 官方脚注 [1]：1K/2K 1120 tokens ($0.134)，4K 2000 tokens ($0.24)
    prices: { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
    tokenPrices: { inputPerMillion: 2, textOutputPerMillion: 12, imageOutputPerMillion: 120 },
    priceSource: PRICE_SOURCE_URL,
    priceCheckedAt: PRICE_CHECKED_AT,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    description: '上一代主力模型',
    location: 'global',
    maxReferenceImages: 14,
    // 官方脚注 [2]：512 $0.045，1K $0.067，2K $0.101，4K $0.15（Global 区域）
    prices: { '1K': 0.067, '2K': 0.101, '4K': 0.15 },
    tokenPrices: { inputPerMillion: 0.5, textOutputPerMillion: 3, imageOutputPerMillion: 60 },
    priceSource: PRICE_SOURCE_URL,
    priceCheckedAt: PRICE_CHECKED_AT,
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    description: '轻量低价；官方仅列出 1K 价格',
    location: 'global',
    maxReferenceImages: 14,
    // 官方脚注 [3]：仅 1K 1120 tokens ($0.034)；2K/4K 未列出
    prices: { '1K': 0.034, '2K': null, '4K': null },
    tokenPrices: { inputPerMillion: 0.25, textOutputPerMillion: 1.5, imageOutputPerMillion: 30 },
    priceSource: PRICE_SOURCE_URL,
    priceCheckedAt: PRICE_CHECKED_AT,
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    description: '旧版兜底模型；官方仅列出 1024×1024 价格',
    location: 'global',
    maxReferenceImages: 14,
    // 官方脚注 ***：1024x1024 图片 1290 tokens ($0.039)；其他分辨率未列出
    prices: { '1K': 0.039, '2K': null, '4K': null },
    tokenPrices: { inputPerMillion: 0.3, textOutputPerMillion: 2.5, imageOutputPerMillion: 30 },
    priceSource: PRICE_SOURCE_URL,
    priceCheckedAt: PRICE_CHECKED_AT,
  },
  {
    id: 'sensenova-u1.5-lite',
    name: 'SenseNova U1.5 Lite (商汤)',
    description: '商汤图像生成与编辑模型，支持最多 5 张参考图，第一张为主编辑图',
    provider: 'sensenova',
    maxReferenceImages: SENSENOVA_MAX_REFERENCE_IMAGES,
    // token 套餐按订阅计费，接口未提供单张价格
    prices: { '1K': null, '2K': null, '4K': null },
    priceSource: 'https://platform.sensenova.cn/docs',
    priceCheckedAt: '2026-10-30',
  },
  {
    id: 'copilot-image',
    name: 'Microsoft Copilot',
    description: '经自建 Copilot API 服务生图，约 45–60 秒一张，最多 4 张参考图，比例仅靠提示词引导',
    provider: 'copilot',
    maxReferenceImages: COPILOT_MAX_REFERENCE_IMAGES,
    // 使用个人 Copilot 会员额度，不按张计费
    prices: { '1K': 0, '2K': null, '4K': null },
    priceCheckedAt: '2026-10-31',
  },
]

export function defaultModel(id: string) {
  return DEFAULT_MODELS.find(item => item.id === id)
}

export interface ModelCapabilities {
  provider: ModelProvider
  maxReferenceImages: number
  supportedAspectRatios: readonly AspectRatio[]
  supportedImageSizes: readonly ImageSize[]
}

export function resolveModelCapabilities(id: string, definition?: Partial<Pick<ModelDefinition, 'provider' | 'maxReferenceImages'>>): ModelCapabilities {
  const item = defaultModel(id) ?? definition
  const lower = id.toLowerCase()
  const provider = item?.provider ?? (lower.includes('sensenova') ? 'sensenova' : lower.includes('copilot') ? 'copilot' : 'vertex')
  if (provider === 'copilot') {
    // Copilot 无尺寸参数；参考图经 /v1/images/edits 上传
    return { provider, maxReferenceImages: COPILOT_MAX_REFERENCE_IMAGES, supportedAspectRatios: COPILOT_ASPECT_RATIOS, supportedImageSizes: COPILOT_IMAGE_SIZES }
  }
  return {
    provider,
    // 自定义商汤模型能力未知，保守禁用参考图；只有代码内置定义才声明上限。
    maxReferenceImages: provider === 'sensenova' ? defaultModel(id)?.maxReferenceImages ?? 0 : item?.maxReferenceImages ?? 14,
    supportedAspectRatios: provider === 'sensenova' ? SENSENOVA_ASPECT_RATIOS : ASPECT_RATIOS,
    supportedImageSizes: provider === 'sensenova' ? SENSENOVA_IMAGE_SIZES : IMAGE_SIZES,
  }
}

/**
 * 合并单价：管理员在设置里填写的正数优先；未填写或为 0 时回落到代码内的官方价格；都没有时为 null（待确认）。
 */
export function effectivePrice(id: string, size: ImageSize, overrides: Record<string, Partial<Record<ImageSize, number | null>>> | undefined) {
  const override = Number(overrides?.[id]?.[size])
  if (Number.isFinite(override) && override > 0) return override
  return defaultModel(id)?.prices[size] ?? null
}
