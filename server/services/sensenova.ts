import type { AspectRatio, ImageSize } from '#shared/types/api'
import { AppError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'
import { withTimeout } from '#server/utils/async'

export interface SenseNovaImageRequest {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  seed?: number
  numInferenceSteps?: number
}

export interface SenseNovaImageResult {
  images: Array<{ data: Buffer, mimeType: string }>
  text: string
  finishReasons: string[]
  inputTokens: number
  outputTokens: number
}

const RATIO_BASE_DIMENSIONS: Record<AspectRatio, [number, number]> = {
  '1:1': [1024, 1024],
  '4:3': [1152, 864],
  '3:4': [864, 1152],
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '3:2': [1200, 800],
  '2:3': [800, 1200],
  '5:4': [1120, 896],
  '4:5': [896, 1120],
  '21:9': [1536, 640],
  '1:4': [512, 2048],
  '4:1': [2048, 512],
  '1:8': [256, 2048],
  '8:1': [2048, 256],
}

/**
 * 将比例和分辨率档位映射为商汤图像生成接口所支持的像素宽高（默认整除 16 或 64）。
 */
export function mapDimensions(aspectRatio: AspectRatio, imageSize: ImageSize): { width: number, height: number } {
  const [baseW, baseH] = RATIO_BASE_DIMENSIONS[aspectRatio] ?? [1024, 1024]
  let scale = 1
  if (imageSize === '2K') scale = 1.5
  else if (imageSize === '4K') scale = 2

  // 取整并对其到 16 像素对齐
  const align = (n: number) => Math.min(4096, Math.max(256, Math.round((n * scale) / 16) * 16))
  return {
    width: align(baseW),
    height: align(baseH),
  }
}

export async function checkSenseNovaConnection() {
  const config = getServerConfig().sensenova
  if (!config.apiKey) {
    throw new AppError('SENSENOVA_NOT_CONFIGURED', '未配置 SENSENOVA_API_KEY', 503)
  }
  const endpoint = `${config.baseUrl}/models`
  const res = await withTimeout(
    fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    }),
    8_000,
    'SenseNova 连接检查超时'
  )
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new AppError('SENSENOVA_AUTH_FAILED', `SenseNova 响应异常 (HTTP ${res.status}): ${errorText.slice(0, 120)}`, res.status)
  }
}

export async function generateWithSenseNova(input: SenseNovaImageRequest): Promise<SenseNovaImageResult> {
  const config = getServerConfig().sensenova
  if (!config.apiKey) {
    throw new AppError('SENSENOVA_NOT_CONFIGURED', '请先在 .env 中配置 SENSENOVA_API_KEY', 503)
  }

  const { width, height } = mapDimensions(input.aspectRatio, input.imageSize)

  const payload: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    width,
    height,
    size: `${width}x${height}`,
  }
  if (input.seed !== undefined) payload.seed = input.seed
  if (input.numInferenceSteps !== undefined) payload.num_inference_steps = input.numInferenceSteps

  const endpoint = `${config.baseUrl}/images/generations`
  const response = await withTimeout(
    fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
    120_000,
    'SenseNova 图像生成超时'
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    let parsedMessage = errorText
    try {
      const errJson = JSON.parse(errorText)
      parsedMessage = errJson.error?.message || errJson.message || errorText
    } catch {
      // 保持原始文本
    }
    const status = response.status
    const isAuth = status === 401 || status === 403
    const isRate = status === 429
    throw new AppError(
      isAuth ? 'VERTEX_AUTH_FAILED' : isRate ? 'QUOTA_EXCEEDED' : 'GENERATION_FAILED',
      `SenseNova 生成失败 (HTTP ${status}): ${parsedMessage || response.statusText}`,
      status >= 400 && status < 600 ? status : 502
    )
  }

  const result = await response.json()
  const data = result.data as Array<{ url?: string, b64_json?: string, revised_prompt?: string }> | undefined
  if (!data?.length) {
    throw new AppError('NO_IMAGE_RETURNED', 'SenseNova 未返回图片数据', 502)
  }

  const first = data[0]!
  let buffer: Buffer
  let mimeType = 'image/png'

  if (first.b64_json) {
    buffer = Buffer.from(first.b64_json, 'base64')
  } else if (first.url) {
    const imgRes = await withTimeout(fetch(first.url), 30_000, '下载 SenseNova 生成图片超时')
    if (!imgRes.ok) {
      throw new AppError('SENSENOVA_DOWNLOAD_FAILED', `下载生成图片失败 (HTTP ${imgRes.status})`, 502)
    }
    mimeType = imgRes.headers.get('content-type') || 'image/png'
    buffer = Buffer.from(await imgRes.arrayBuffer())
  } else {
    throw new AppError('NO_IMAGE_RETURNED', 'SenseNova 返回的图片缺少有效链接或内容', 502)
  }

  return {
    images: [{ data: buffer, mimeType }],
    text: first.revised_prompt || '',
    finishReasons: ['STOP'],
    inputTokens: 0,
    outputTokens: 0,
  }
}
