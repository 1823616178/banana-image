import { AppError, errorMessage } from '#server/utils/errors'

export interface ClassifiedGenerationError {
  code: string
  message: string
  retry: 'quota' | 'timeout' | 'transient' | 'never'
  blocked: boolean
}

export function classifyGenerationError(error: unknown): ClassifiedGenerationError {
  const candidate = error as { code?: string | number, status?: string | number, statusCode?: number }
  const code = candidate?.code ?? candidate?.status ?? candidate?.statusCode
  const message = errorMessage(error)
  const normalized = `${code ?? ''} ${message}`.toLowerCase()

  if (/(^|\D)429(\D|$)|resource_exhausted|quota|rate.limit/.test(normalized)) {
    return { code: 'QUOTA_EXCEEDED', message: 'Vertex 额度或频率受限，请稍后重试', retry: 'quota', blocked: false }
  }
  if (/(^|\D)40[13](\D|$)|unauthenticated|permission.denied|forbidden|unauthorized/.test(normalized)) {
    return { code: 'VERTEX_AUTH_FAILED', message: 'Vertex 认证失败，请运行 gcloud auth application-default login 并检查项目权限', retry: 'never', blocked: false }
  }
  if (/(^|\D)404(\D|$)|not.found/.test(normalized)) {
    return { code: 'MODEL_NOT_FOUND', message: '模型 ID 或 location 不正确，请检查模型设置', retry: 'never', blocked: false }
  }
  if (/timeout|timed.out|deadline.exceeded/.test(normalized)) {
    return { code: 'VERTEX_TIMEOUT', message: 'Vertex 图像生成超时', retry: 'timeout', blocked: false }
  }
  if (/safety|prohibited.content|blocked/.test(normalized)) {
    return { code: 'CONTENT_BLOCKED', message: '提示词或参考图触发了安全限制，请调整内容后重试', retry: 'never', blocked: true }
  }
  if (/(^|\D)5\d\d(\D|$)|econnreset|etimedout|network|temporarily.unavailable/.test(normalized)) {
    return { code: 'VERTEX_UNAVAILABLE', message: 'Vertex 暂时不可用，请稍后重试', retry: 'transient', blocked: false }
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
