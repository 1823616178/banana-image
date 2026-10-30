import { TimeoutError } from '#server/utils/async'
import { AppError, errorMessage } from '#server/utils/errors'
import type { ModelProvider } from '#shared/types/api'

export interface ClassifiedGenerationError {
  code: string
  message: string
  retry: 'quota' | 'timeout' | 'transient' | 'never'
  blocked: boolean
}

export function classifyGenerationError(error: unknown, provider: ModelProvider = 'vertex'): ClassifiedGenerationError {
  const candidate = error as { code?: string | number, status?: string | number, statusCode?: number }
  const code = candidate?.code ?? candidate?.status ?? candidate?.statusCode
  const message = errorMessage(error)
  const normalized = `${code ?? ''} ${message}`.toLowerCase()
  if (String(code).startsWith('SENSENOVA_')) provider = 'sensenova'
  const prefix = provider === 'sensenova' ? 'SENSENOVA' : 'VERTEX'
  const label = provider === 'sensenova' ? 'SenseNova' : 'Vertex'

  if (code === 'SENSENOVA_NOT_CONFIGURED' || code === 'VERTEX_NOT_CONFIGURED') {
    return { code, message, retry: 'never', blocked: false }
  }

  // 本地 withTimeout 抛出的超时（中文消息）也要走超时重试，必须先于其他规则判断。
  if (error instanceof TimeoutError || code === 'TIMEOUT') {
    return { code: `${prefix}_TIMEOUT`, message: `${label} 图像生成超时`, retry: 'timeout', blocked: false }
  }

  if (/(^|\D)429(\D|$)|resource_exhausted|quota|rate.limit/.test(normalized)) {
    return { code: 'QUOTA_EXCEEDED', message: `${label} 额度或频率受限，请稍后重试`, retry: 'quota', blocked: false }
  }
  if (/(^|\D)40[13](\D|$)|unauthenticated|permission.denied|forbidden|unauthorized|auth.failed/.test(normalized)) {
    return { code: `${prefix}_AUTH_FAILED`, message: provider === 'sensenova' ? 'SenseNova 认证失败，请检查 SENSENOVA_API_KEY 及模型权限' : 'Vertex 认证失败，请运行 gcloud auth application-default login 并检查项目权限', retry: 'never', blocked: false }
  }
  if (/(^|\D)404(\D|$)|not.found/.test(normalized)) {
    return { code: 'MODEL_NOT_FOUND', message: provider === 'sensenova' ? 'SenseNova 模型 ID 不正确，请检查模型设置' : '模型 ID 或 location 不正确，请检查模型设置', retry: 'never', blocked: false }
  }
  if (/timeout|timed.?out|deadline.exceeded|超时/.test(normalized)) {
    return { code: `${prefix}_TIMEOUT`, message: `${label} 图像生成超时`, retry: 'timeout', blocked: false }
  }
  if (/safety|prohibited.content|blocked/.test(normalized)) {
    return { code: 'CONTENT_BLOCKED', message: '提示词或参考图触发了安全限制，请调整内容后重试', retry: 'never', blocked: true }
  }
  if (/(^|\D)5\d\d(\D|$)|econnreset|etimedout|network|temporarily.unavailable|_unavailable/.test(normalized)) {
    return { code: `${prefix}_UNAVAILABLE`, message: `${label} 暂时不可用，请稍后重试`, retry: 'transient', blocked: false }
  }
  return { code: 'GENERATION_FAILED', message: message.slice(0, 1000) || '图像生成失败', retry: 'never', blocked: false }
}

export function noImageError(finishReasons: string[], text: string) {
  const reasons = finishReasons.join(' ')
  if (/SAFETY|PROHIBITED_CONTENT|IMAGE_SAFETY/i.test(reasons)) {
    return new AppError('CONTENT_BLOCKED', `生成被安全策略拦截（${reasons}），请修改提示词`, 422)
  }
  return new AppError('NO_IMAGE_RETURNED', text ? `模型未返回图片：${text.slice(0, 800)}` : '模型未返回图片', 502)
}

/** 各类错误允许的最大重试次数：配额 3 次、超时 1 次、临时故障 2 次，其余不重试。 */
export const RETRY_LIMITS = { quota: 3, timeout: 1, transient: 2, never: 0 } as const

export function shouldRetry(classified: Pick<ClassifiedGenerationError, 'retry'>, attempt: number) {
  return attempt < RETRY_LIMITS[classified.retry]
}

export function retryDelayMs(attempt: number) {
  return 2 ** attempt * 1000
}
