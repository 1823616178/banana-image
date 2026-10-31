import { Agent } from 'undici'
import type { AspectRatio, ImageSize } from '#shared/types/api'
import { COPILOT_ASPECT_RATIOS, COPILOT_IMAGE_SIZES, COPILOT_MAX_REFERENCE_IMAGES } from '#shared/config/copilot'
import { checkCopilotState, COPILOT_TIMEOUT_MS, COPILOT_DOWNLOAD_TIMEOUT_MS, withCopilotSlot } from '#server/services/copilotQueue'
import { AppError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'
import { TimeoutError, withAbortableTimeout } from '#server/utils/async'

export interface CopilotImageRequest {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  referenceImages?: Array<{ data: Buffer, mimeType: string }>
}

export interface CopilotImageResult {
  images: Array<{ data: Buffer, mimeType: string }>
  text: string
  finishReasons: string[]
  inputTokens: number
  outputTokens: number
}

interface CopilotResponse {
  data?: Array<{ url?: string, b64_json?: string, revised_prompt?: string | null }>
}

export { COPILOT_TIMEOUT_MS } from '#server/services/copilotQueue'
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
// 同时延长 HTTP 客户端的响应头超时，避免 fetch 默认的 300s 提前断开连接。
const dispatcher = new Agent({ headersTimeout: COPILOT_TIMEOUT_MS, bodyTimeout: COPILOT_TIMEOUT_MS })
export const closeCopilotConnections = () => dispatcher.close()

/** Copilot 无尺寸参数，只能用文字提示画面比例。 */
export function aspectRatioHint(aspectRatio: AspectRatio) {
  const [w, h] = aspectRatio.split(':').map(Number) as [number, number]
  const orientation = w > h ? '横版' : w < h ? '竖版' : '正方形'
  return `（画面比例 ${aspectRatio}，${orientation}构图）`
}

export async function checkCopilotConnection() {
  const config = getServerConfig().copilot
  if (!config.baseUrl) {
    throw new AppError('COPILOT_NOT_CONFIGURED', '未配置 COPILOT_BASE_URL', 503)
  }
  await checkCopilotState(config.baseUrl)
  await withAbortableTimeout(async (signal) => {
    const res = await fetch(`${config.baseUrl}/healthz`, { method: 'GET', signal })
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new AppError(res.status === 401 || res.status === 403 ? 'COPILOT_AUTH_FAILED' : 'COPILOT_UNAVAILABLE', `Copilot 服务响应异常 (HTTP ${res.status}): ${errorText.slice(0, 120)}`, res.status)
    }
    const health = await res.json() as { status?: string, token_file?: boolean } | null
    if (health?.status !== 'ok' || typeof health.token_file !== 'boolean') {
      throw new AppError('COPILOT_UNAVAILABLE', 'Copilot 健康检查返回了无效状态', 502)
    }
    if (!health.token_file) {
      throw new AppError('COPILOT_AUTH_FAILED', 'Copilot 尚未登录，请在 Copilot API 服务器上登录或配置 token.json', 503)
    }
  }, 8_000, 'Copilot 连接检查超时')
}

export async function generateWithCopilot(input: CopilotImageRequest): Promise<CopilotImageResult> {
  return prepareCopilotGeneration(input)()
}

export function prepareCopilotGeneration(input: CopilotImageRequest, options: { signal?: AbortSignal } = {}): () => Promise<CopilotImageResult> {
  const config = getServerConfig().copilot
  if (!config.baseUrl) {
    throw new AppError('COPILOT_NOT_CONFIGURED', '请先在 .env 中配置 COPILOT_BASE_URL', 503)
  }
  const references = input.referenceImages ?? []
  if (references.length > COPILOT_MAX_REFERENCE_IMAGES) {
    throw new AppError('TOO_MANY_REFERENCES', `Copilot 最多使用 ${COPILOT_MAX_REFERENCE_IMAGES} 张参考图`, 400)
  }
  if (!COPILOT_IMAGE_SIZES.includes(input.imageSize)) {
    throw new AppError('UNSUPPORTED_IMAGE_SIZE', 'Copilot 仅支持 1K 分辨率', 400)
  }
  if (!COPILOT_ASPECT_RATIOS.includes(input.aspectRatio)) {
    throw new AppError('UNSUPPORTED_ASPECT_RATIO', 'Copilot 不支持该画布比例', 400)
  }
  const prompt = `${input.prompt}${aspectRatioHint(input.aspectRatio)}`
  if (references.length) {
    const endpoint = `${config.baseUrl}/v1/images/edits`
    return () => sendCopilotRequest(endpoint, () => {
      // 每次调用重新构造表单，重试时不复用已消费的 body。
      const form = new FormData()
      form.append('model', input.model)
      form.append('prompt', prompt)
      form.append('n', '1')
      form.append('response_format', 'url')
      references.forEach((ref, index) => {
        const ext = ref.mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
        form.append('image[]', new Blob([new Uint8Array(ref.data)], { type: ref.mimeType }), `reference-${index + 1}.${ext}`)
      })
      return form
    }, options.signal)
  }
  const body = JSON.stringify({ model: input.model, prompt, n: 1, response_format: 'url' })
  const endpoint = `${config.baseUrl}/v1/images/generations`
  return () => sendCopilotRequest(endpoint, () => body, options.signal)
}

async function sendCopilotRequest(endpoint: string, createBody: () => string | FormData, stopSignal?: AbortSignal): Promise<CopilotImageResult> {
  const result = await withCopilotSlot(endpoint, stopSignal, slot => withAbortableTimeout(async (signal) => {
    // 获得串行执行权之后才复制参考图，排队请求只保留原始 Buffer。
    const body = createBody()
    // FormData 由 fetch 自动带上 multipart boundary。
    const headers: Record<string, string> = typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}
    await slot.start()
    const requestOptions: RequestInit & { dispatcher: Agent } = { method: 'POST', signal, headers, body, dispatcher }
    const response = await fetch(endpoint, requestOptions)
    if (!response.ok) {
      const errorText = await response.text()
      let parsedMessage = errorText
      let errorType: string | undefined
      try {
        const errJson = JSON.parse(errorText)
        parsedMessage = errJson.error?.message || errJson.detail || errJson.message || errorText
        errorType = errJson.error?.type
      } catch {
        // 保持原始文本
      }
      const status = response.status
      // 代理的 5xx 可能先于上游任务结束；只信任桥接服务明确返回的错误。
      if (status < 500 || ['upstream_error', 'upstream_timeout', 'clearance_required', 'authentication_error', 'rate_limit_error', 'invalid_request_error'].includes(errorType ?? '')) slot.complete()
      if (status === 401 || status === 403) {
        throw new AppError('COPILOT_AUTH_FAILED', `Copilot 登录已失效 (HTTP ${status}): ${parsedMessage}`, status)
      }
      if (status === 504) {
        throw new AppError('GENERATION_FAILED', `Copilot 上游超时 (HTTP 504): ${parsedMessage}`, 504)
      }
      throw new AppError(
        status === 429 ? 'QUOTA_EXCEEDED' : 'GENERATION_FAILED',
        `Copilot 生成失败 (HTTP ${status}): ${parsedMessage || response.statusText}`,
        status >= 400 && status < 600 ? status : 502
      )
    }
    const result = await response.json() as CopilotResponse
    slot.complete()
    return result
  }, COPILOT_TIMEOUT_MS, 'Copilot 图像生成超时'))

  const first = result.data?.[0]
  if (!first) throw new AppError('NO_IMAGE_RETURNED', 'Copilot 未返回图片数据', 502)

  let buffer: Buffer
  let mimeType = 'image/png'
  if (first.b64_json) {
    buffer = Buffer.from(first.b64_json, 'base64')
  } else if (first.url) {
    const downloaded = await downloadCopilotImage(first.url)
    mimeType = downloaded.mimeType.startsWith('image/') ? downloaded.mimeType : 'image/png'
    buffer = downloaded.data
  } else {
    throw new AppError('NO_IMAGE_RETURNED', 'Copilot 返回的图片缺少有效链接或内容', 502)
  }

  return {
    images: [{ data: buffer, mimeType }],
    text: first.revised_prompt || '',
    finishReasons: ['STOP'],
    inputTokens: 0,
    outputTokens: 0,
  }
}

/** 只重试已生成图片的下载；失败后不再消耗额度重新生成。 */
async function downloadCopilotImage(url: string) {
  const deadline = Date.now() + COPILOT_DOWNLOAD_TIMEOUT_MS
  for (let attempt = 0; ; attempt++) {
    let retryable = true
    try {
      return await withAbortableTimeout(async (signal) => {
        const response = await fetch(url, { signal })
        if (!response.ok) {
          retryable = [401, 403, 404, 408, 429].includes(response.status) || response.status >= 500
          await response.body?.cancel()
          throw new AppError('COPILOT_DOWNLOAD_FAILED', `下载 Copilot 生成图片失败 (HTTP ${response.status})`, 502)
        }
        return { mimeType: response.headers.get('content-type') || 'image/png', data: Buffer.from(await response.arrayBuffer()) }
      }, Math.min(30_000, deadline - Date.now()), '下载 Copilot 生成图片超时')
    } catch (error) {
      const backoff = 2 ** attempt * 1000
      if (!retryable || attempt >= 2 || Date.now() + backoff >= deadline) {
        if (error instanceof AppError && error.code === 'COPILOT_DOWNLOAD_FAILED') throw error
        throw new AppError('COPILOT_DOWNLOAD_FAILED', error instanceof TimeoutError ? '下载 Copilot 生成图片超时' : '下载 Copilot 生成图片失败，请稍后重试', 502, undefined, { cause: error })
      }
      await delay(backoff)
    }
  }
}
