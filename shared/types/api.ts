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

export type ModelProvider = 'vertex' | 'sensenova' | 'copilot'

export interface HealthCheck {
  status: 'ok' | 'error' | 'disabled'
  message: string
  latencyMs: number
}

export interface HealthDto {
  database: HealthCheck
  redis: HealthCheck
  vertex: HealthCheck
  sensenova: HealthCheck
  copilot: HealthCheck
  ftp: HealthCheck
}

export type UserRole = 'admin' | 'user'

export interface AuthUserDto {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

export interface PageDto<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface GenerationDefaults {
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  count: number
}

export interface SettingsDto {
  defaults: GenerationDefaults
  dailyBudgetUsd: number
  rateLimitPerMinute: number
  creditGrantUsd: number
  theme: 'system' | 'light' | 'dark'
  allowRegistration: boolean
  registrationForcedByEnv: boolean
  pricing: PricingDto
  canManageShared: boolean
}

export interface ModelDto {
  id: string
  name: string
  description: string
  provider?: ModelProvider
  maxReferenceImages: number
  supportedAspectRatios?: readonly AspectRatio[]
  supportedImageSizes?: readonly ImageSize[]
  /** 实际生效的每张单价（USD）；null 表示待确认 */
  prices: Record<ImageSize, number | null>
  /** 代码内置的官方单价 */
  officialPrices: Record<ImageSize, number | null>
  tokenPrices: { inputPerMillion: number, textOutputPerMillion: number, imageOutputPerMillion: number } | null
  priceSource: string | null
  priceCheckedAt: string | null
}

export interface UsageDayDto {
  date: string
  images: number
  costUsd: number
}

export interface UsageStatsDto {
  rangeDays: number
  totalImages: number
  totalCostUsd: number
  todayCostUsd: number
  monthCostUsd: number
  creditGrantUsd: number
  days: UsageDayDto[]
  byModel: { model: string, images: number, costUsd: number }[]
}

export interface PresetDto {
  id: string
  name: string
  promptSuffix: string
  sort: number
  enabled: boolean
  shared: boolean
  editable: boolean
}

export interface TemplateDto {
  id: string
  title: string
  content: string
  useCount: number
  shared: boolean
  editable: boolean
}

export interface AdminUserDto extends AuthUserDto {
  disabled: boolean
  lastLoginAt: string | null
}

export type PricingDto = Record<string, Partial<Record<ImageSize, number>>>

export interface PromptRecommendationDto {
  imageId: string
  model: string
  analysis: {
    isWig: boolean
    wigType: string
    length: string
    color: string
    density: string
    hairline: string
    texture: string
    summaryZh: string
  }
  prompts: Array<{ scene: string, labelZh: string, explanationZh: string, prompt: string }>
  inputTokens: number
  outputTokens: number
  /** 按官方 token 单价估算；模型单价未知时为 null */
  costUsd: number | null
}
