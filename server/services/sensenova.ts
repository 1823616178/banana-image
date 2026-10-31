import type { AspectRatio, ImageSize } from '#shared/types/api'
import { SENSENOVA_ASPECT_RATIOS, SENSENOVA_IMAGE_SIZES, SENSENOVA_MAX_REFERENCE_IMAGES } from '#shared/config/sensenova'
import { AppError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'
import { withAbortableTimeout } from '#server/utils/async'

export interface SenseNovaImageRequest {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  referenceImages?: Array<{ data: Buffer, mimeType: string }>
}

export interface SenseNovaImageResult {
  images: Array<{ data: Buffer, mimeType: string }>
  text: string
  finishReasons: string[]
  inputTokens: number
  outputTokens: number
}

interface SenseNovaResponse {
  data?: Array<{ url?: string, b64_json?: string, revised_prompt?: string }>
  output_format?: string
  usage?: { input_tokens?: number, output_tokens?: number }
}

/**
 * 按分辨率档位的像素面积缩放；单边不超过 4096，宽高为 32 的倍数。
 * https://platform.sensenova.cn/docs#model-u1-5-lite
 */
export function mapDimensions(aspectRatio: AspectRatio, imageSize: ImageSize): { width: number, height: number } {
  if (!SENSENOVA_IMAGE_SIZES.includes(imageSize)) {
    throw new AppError('UNSUPPORTED_IMAGE_SIZE', '当前商汤模型不支持该分辨率', 400)
  }
  if (!SENSENOVA_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new AppError('UNSUPPORTED_ASPECT_RATIO', 'SenseNova 仅支持 1:3 到 3:1 之间的宽高比', 400)
  }
  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number) as [number, number]
  const side = { '1K': 1024, '2K': 2048, '4K': 4096 }[imageSize]
  const scale = Math.min(side / Math.sqrt(ratioWidth * ratioHeight), 4096 / Math.max(ratioWidth, ratioHeight))
  const align = (n: number) => Math.min(4096, Math.max(512, Math.round(n / 32) * 32))
  return {
    width: align(ratioWidth * scale),
    height: align(ratioHeight * scale),
  }
}

export async function checkSenseNovaConnection() {
  const config = getServerConfig().sensenova
  if (!config.apiKey) {
    throw new AppError('SENSENOVA_NOT_CONFIGURED', '未配置 SENSENOVA_API_KEY', 503)
  }
  const endpoint = `${config.baseUrl}/models`
  await withAbortableTimeout(async (signal) => {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new AppError('SENSENOVA_AUTH_FAILED', `SenseNova 响应异常 (HTTP ${res.status}): ${errorText.slice(0, 120)}`, res.status)
    }
  }, 8_000, 'SenseNova 连接检查超时')
}

export async function generateWithSenseNova(input: SenseNovaImageRequest): Promise<SenseNovaImageResult> {
  const config = getServerConfig().sensenova
  if (!config.apiKey) {
    throw new AppError('SENSENOVA_NOT_CONFIGURED', '请先在 .env 中配置 SENSENOVA_API_KEY', 503)
  }

  const references = input.referenceImages ?? []
  if (references.length > SENSENOVA_MAX_REFERENCE_IMAGES) {
    throw new AppError('TOO_MANY_REFERENCES', `SenseNova 最多使用 ${SENSENOVA_MAX_REFERENCE_IMAGES} 张参考图`, 400)
  }
  const { width, height } = mapDimensions(input.aspectRatio, input.imageSize)

  const payload: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    size: `${width}x${height}`,
    output_format: 'png',
    response_format: 'b64_json',
    watermark: true,
    prompt_extend: true,
  }
  if (references.length) {
    payload.images = references.map(image => ({ image_url: `data:${image.mimeType};base64,${image.data.toString('base64')}` }))
  }

  const endpoint = `${config.baseUrl}/images/${references.length ? 'edits' : 'generations'}`
  const result = await withAbortableTimeout(async (signal) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
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
        isAuth ? 'SENSENOVA_AUTH_FAILED' : isRate ? 'QUOTA_EXCEEDED' : 'GENERATION_FAILED',
        `SenseNova 生成失败 (HTTP ${status}): ${parsedMessage || response.statusText}`,
        status >= 400 && status < 600 ? status : 502
      )
    }

    return await response.json() as SenseNovaResponse
  }, 120_000, 'SenseNova 图像生成超时')

  const data = result.data
  if (!data?.length) {
    throw new AppError('NO_IMAGE_RETURNED', 'SenseNova 未返回图片数据', 502)
  }

  const first = data[0]!
  let buffer: Buffer
  let mimeType = 'image/png'

  if (first.b64_json) {
    buffer = Buffer.from(first.b64_json, 'base64')
  } else if (first.url) {
    const url = first.url
    const downloaded = await withAbortableTimeout(async (signal) => {
      const imgRes = await fetch(url, { signal })
      if (!imgRes.ok) {
        throw new AppError('SENSENOVA_DOWNLOAD_FAILED', `下载生成图片失败 (HTTP ${imgRes.status})`, 502)
      }
      return { mimeType: imgRes.headers.get('content-type') || 'image/png', data: Buffer.from(await imgRes.arrayBuffer()) }
    }, 30_000, '下载 SenseNova 生成图片超时')
    mimeType = downloaded.mimeType
    buffer = downloaded.data
  } else {
    throw new AppError('NO_IMAGE_RETURNED', 'SenseNova 返回的图片缺少有效链接或内容', 502)
  }

  return {
    images: [{ data: buffer, mimeType }],
    text: first.revised_prompt || '',
    finishReasons: ['STOP'],
    inputTokens: result.usage?.input_tokens ?? 0,
    outputTokens: result.usage?.output_tokens ?? 0,
  }
}
