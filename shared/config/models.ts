import type { AspectRatio, ImageSize } from '../types/api'

export const ASPECT_RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'] as const satisfies readonly AspectRatio[]
export const IMAGE_SIZES = ['1K', '2K', '4K'] as const satisfies readonly ImageSize[]

export interface ModelDefinition {
  id: string
  name: string
  description: string
  location: 'global'
  maxReferenceImages: number
  prices: Record<ImageSize, number>
}

export const DEFAULT_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-nano-banana-2.1',
    name: 'Nano Banana 2.1',
    description: '默认主力模型，支持多轮编辑',
    location: 'global',
    maxReferenceImages: 14,
    prices: { '1K': 0.034, '2K': 0.05, '4K': 0.113 },
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: '复杂构图与文字渲染，单价需按官方页面确认',
    location: 'global',
    maxReferenceImages: 14,
    prices: { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    description: '上一代主力模型，单价需按官方页面确认',
    location: 'global',
    maxReferenceImages: 14,
    prices: { '1K': 0.067, '2K': 0.101, '4K': 0.15 },
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    description: 'Vertex 可用性与单价需实测',
    location: 'global',
    maxReferenceImages: 14,
    prices: { '1K': 0.034, '2K': 0, '4K': 0 },
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    description: '旧版兜底模型，单价需按官方页面确认',
    location: 'global',
    maxReferenceImages: 14,
    prices: { '1K': 0.039, '2K': 0, '4K': 0 },
  },
]
