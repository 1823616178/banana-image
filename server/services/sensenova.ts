import type { AspectRatio, ImageSize } from '#shared/types/api'
import { SENSENOVA_DIMENSIONS } from '#shared/config/sensenova'
import { AppError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'
import { withAbortableTimeout } from '#server/utils/async'

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

/** 使用官方尺寸桶，拒绝不支持的比例或分辨率，不通过缩放伪造档位。 */
export function mapDimensions(aspectRatio: AspectRatio, imageSize: ImageSize): { width: number, height: number } {
  const dimensions = SENSENOVA_DIMENSIONS[imageSize]
  if (!dimensions) throw new AppError('UNSUPPORTED_IMAGE_SIZE', '当前商汤模型仅支持 1K、2K 分辨率', 400)
  const size = dimensions[aspectRatio]
  if (!size) throw new AppError('UNSUPPORTED_ASPECT_RATIO', '当前商汤模型不支持该画布比例', 400)
  return { width: size[0], height: size[1] }
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

  const { width, height } = mapDimensions(input.aspectRatio, input.imageSize)

  const payload: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    size: `${width}x${height}`,
    response_format: 'url',
  }
  if (input.seed !== undefined) payload.seed = input.seed
  if (input.numInferenceSteps !== undefined) payload.num_inference_steps = input.numInferenceSteps

  const endpoint = `${config.baseUrl}/images/generations`
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
      const errorText = await response.text().catch(() => '')
      let parsedMessage = errorText
      try {
        const errJson = JSON.parse(errorText)
        const message = errJson.error?.message || errJson.message
        if (typeof message === 'string') parsedMessage = message
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
    return await response.json()
  }, 120_000, 'SenseNova 图像生成超时')
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
    const imageUrl = first.url
    const image = await withAbortableTimeout(async (signal) => {
      const imgRes = await fetch(imageUrl, { signal })
      if (!imgRes.ok) {
        throw new AppError('SENSENOVA_DOWNLOAD_FAILED', `下载生成图片失败 (HTTP ${imgRes.status})`, 502)
      }
      return { mimeType: imgRes.headers.get('content-type') || 'image/png', data: Buffer.from(await imgRes.arrayBuffer()) }
    }, 30_000, '下载 SenseNova 生成图片超时')
    mimeType = image.mimeType
    buffer = image.data
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
