export interface ApiSuccess<T> {
  code: 0
  data: T
  message: string
}

export interface ApiFailure {
  code: string | number
  message: string
  details?: unknown
}

export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'blocked' | 'canceled'
export type ImageSource = 'generated' | 'upload'
export type AspectRatio = '1:1' | '3:2' | '2:3' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9' | '1:4' | '4:1' | '1:8' | '8:1'
export type ImageSize = '1K' | '2K' | '4K'

export interface ImageDto {
  id: string
  generationId: string | null
  source: ImageSource
  url: string
  thumbUrl: string
  mimeType: string
  width: number
  height: number
  bytes: number
  isFavorite: boolean
  prompt: string | null
  model: string | null
  aspectRatio: string | null
  imageSize: string | null
  createdAt: string
}

export interface GenerationDto {
  id: string
  prompt: string
  finalPrompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  count: number
  mode: 'text2img' | 'edit'
  refImageIds: string[]
  stylePresetId: string | null
  status: GenerationStatus
  errorCode: string | null
  errorMessage: string | null
  inputTokens: number
  outputTokens: number
  costUsd: string
  durationMs: number
  parentImageId: string | null
  images: ImageDto[]
  createdAt: string
  updatedAt: string
}

export interface HealthCheck {
  status: 'ok' | 'error'
  message: string
  latencyMs: number
}

export interface HealthDto {
  database: HealthCheck
  redis: HealthCheck
  vertex: HealthCheck
}
