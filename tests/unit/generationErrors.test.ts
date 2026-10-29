import { describe, expect, it } from 'vitest'
import { classifyGenerationError, noImageError, retryDelayMs, shouldRetry } from '#server/services/generationErrors'
import { TimeoutError, withTimeout } from '#server/utils/async'
import { AppError } from '#server/utils/errors'

describe('错误分类', () => {
  it.each([
    [{ status: 429, message: 'Too many requests' }, 'QUOTA_EXCEEDED', 'quota'],
    [new Error('RESOURCE_EXHAUSTED: quota exceeded'), 'QUOTA_EXCEEDED', 'quota'],
    [{ status: 401, message: 'Unauthenticated' }, 'VERTEX_AUTH_FAILED', 'never'],
    [{ status: 403, message: 'PERMISSION_DENIED' }, 'VERTEX_AUTH_FAILED', 'never'],
    [{ status: 404, message: 'model not found' }, 'MODEL_NOT_FOUND', 'never'],
    [new Error('DEADLINE_EXCEEDED'), 'VERTEX_TIMEOUT', 'timeout'],
    [new Error('request timed out'), 'VERTEX_TIMEOUT', 'timeout'],
    [new Error('Response blocked by SAFETY filter'), 'CONTENT_BLOCKED', 'never'],
    [{ status: 503, message: 'Service Unavailable' }, 'VERTEX_UNAVAILABLE', 'transient'],
    [new Error('socket hang up ECONNRESET'), 'VERTEX_UNAVAILABLE', 'transient'],
    [new Error('something odd'), 'GENERATION_FAILED', 'never'],
  ])('%#: 归类为 %s', (error, code, retry) => {
    expect(classifyGenerationError(error)).toMatchObject({ code: code, retry })
  })

  it('安全拦截标记 blocked', () => {
    expect(classifyGenerationError(new Error('PROHIBITED_CONTENT')).blocked).toBe(true)
  })

  it('本地 withTimeout 的中文超时会归为可重试的超时（此前的缺陷）', async () => {
    const never = new Promise(() => {})
    const error = await withTimeout(never, 5, 'Vertex 图像生成超时').catch(failure => failure)
    expect(error).toBeInstanceOf(TimeoutError)
    expect(classifyGenerationError(error)).toEqual({ code: 'VERTEX_TIMEOUT', message: 'Vertex 图像生成超时', retry: 'timeout', blocked: false })
  })

  it('仅有中文“超时”字样的普通错误也归为超时', () => {
    expect(classifyGenerationError(new Error('请求超时')).retry).toBe('timeout')
  })

  it('Worker 包装后的 AppError 再次分类结果不变', () => {
    const wrapped = new AppError('VERTEX_TIMEOUT', 'Vertex 图像生成超时', 502)
    expect(classifyGenerationError(wrapped).code).toBe('VERTEX_TIMEOUT')
  })

  it('没有图片时区分安全拦截与普通无图', () => {
    expect(noImageError(['IMAGE_SAFETY'], '').code).toBe('CONTENT_BLOCKED')
    expect(noImageError(['STOP'], '只返回了文字').code).toBe('NO_IMAGE_RETURNED')
  })
})

describe('重试策略', () => {
  it('配额 3 次、超时 1 次、临时故障 2 次、其他不重试', () => {
    const allowed = (retry: 'quota' | 'timeout' | 'transient' | 'never') => [0, 1, 2, 3, 4].filter(attempt => shouldRetry({ retry }, attempt)).length
    expect(allowed('quota')).toBe(3)
    expect(allowed('timeout')).toBe(1)
    expect(allowed('transient')).toBe(2)
    expect(allowed('never')).toBe(0)
  })

  it('指数退避 1s、2s、4s', () => {
    expect([0, 1, 2].map(retryDelayMs)).toEqual([1000, 2000, 4000])
  })
})
