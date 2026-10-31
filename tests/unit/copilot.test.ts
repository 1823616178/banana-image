import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aspectRatioHint, checkCopilotConnection, COPILOT_TIMEOUT_MS, generateWithCopilot, prepareCopilotGeneration } from '#server/services/copilot'
import type { CopilotImageRequest } from '#server/services/copilot'
import { classifyGenerationError } from '#server/services/generationErrors'
import { resolveModelCapabilities } from '#shared/config/models'
import { resolveConfiguredModels } from '#server/services/modelCatalog'
import { copilotKeys, COPILOT_LEASE_MS } from '#server/services/copilotQueue'
import { copilotRedis as redis, leases, inflight, resetCopilotRedis } from '../helpers/copilotRedis'

vi.mock('#server/services/redis', async () => {
  const { copilotRedis } = await import('../helpers/copilotRedis')
  return { getRedis: () => copilotRedis }
})

const input: CopilotImageRequest = { prompt: '海边的灯塔', model: 'copilot-image', aspectRatio: '16:9', imageSize: '1K' }
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000/')
  resetCopilotRedis()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Copilot 文生图', () => {
  it('能力：仅 1K、最多 4 张参考图', () => {
    expect(resolveModelCapabilities('copilot-image')).toMatchObject({ provider: 'copilot', maxReferenceImages: 4, supportedImageSizes: ['1K'] })
    expect(aspectRatioHint('16:9')).toContain('横版')
    expect(aspectRatioHint('2:3')).toContain('竖版')
  })

  it('未配置地址时模型不可用', () => {
    vi.stubEnv('COPILOT_BASE_URL', '')
    expect(resolveConfiguredModels([]).find(model => model.id === 'copilot-image')).toMatchObject({ provider: 'copilot', enabled: false })
    return expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_NOT_CONFIGURED' })
  })

  it('调用生成接口并下载图片链接', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://img.example/a.png' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await generateWithCopilot(input)
    expect(fetchMock.mock.calls[0]![0]).toBe('http://copilot.example:8000/v1/images/generations')
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.prompt).toContain('16:9')
    expect(result.images[0]).toEqual({ data: png, mimeType: 'image/png' })
  })

  it('参考图走 edits 接口（multipart）', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ b64_json: png.toString('base64') }] }))
    vi.stubGlobal('fetch', fetchMock)
    const jpeg = Buffer.from([0xff, 0xd8, 0xff])
    const result = await generateWithCopilot({ ...input, referenceImages: [{ data: png, mimeType: 'image/png' }, { data: jpeg, mimeType: 'image/jpeg' }] })
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://copilot.example:8000/v1/images/edits')
    expect(options.headers).toEqual({})
    const form = options.body as FormData
    expect(form.get('prompt')).toContain('16:9')
    const files = form.getAll('image[]') as File[]
    expect(files.map(file => [file.name, file.type])).toEqual([['reference-1.png', 'image/png'], ['reference-2.jpg', 'image/jpeg']])
    expect(Buffer.from(await files[1]!.arrayBuffer())).toEqual(jpeg)
    expect(result.images[0]).toEqual({ data: png, mimeType: 'image/png' })
  })

  it('超过 4 张参考图时拒绝', async () => {
    const refs = Array.from({ length: 5 }, () => ({ data: png, mimeType: 'image/png' }))
    await expect(generateWithCopilot({ ...input, referenceImages: refs })).rejects.toMatchObject({ code: 'TOO_MANY_REFERENCES', statusCode: 400 })
  })

  it('401 / 504 / 5xx 错误分类', async () => {
    for (const [status, code, retry] of [[401, 'COPILOT_AUTH_FAILED', 'never'], [504, 'COPILOT_TIMEOUT', 'timeout'], [502, 'COPILOT_UNAVAILABLE', 'transient']] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'x', type: status === 504 ? 'upstream_timeout' : 'upstream_error' } }), { status })))
      const error = await generateWithCopilot(input).catch(failure => failure)
      expect(classifyGenerationError(error, 'copilot')).toMatchObject({ code, retry })
    }
  })

  it('不同 worker 的四张请求串行执行，排队不占单张超时', async () => {
    vi.resetModules()
    const otherWorker = await import('#server/services/copilot')
    vi.useFakeTimers()
    let active = 0
    let peak = 0
    const fetchMock = vi.fn(async () => {
      peak = Math.max(peak, ++active)
      await new Promise(resolve => setTimeout(resolve, 45_000))
      active--
      return Response.json({ data: [{ b64_json: png.toString('base64') }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const processing = Promise.all([
      generateWithCopilot(input),
      otherWorker.generateWithCopilot(input),
      generateWithCopilot({ ...input, model: 'another-copilot-model' }),
      otherWorker.generateWithCopilot(input),
    ])
    await vi.advanceTimersByTimeAsync(182_000)
    expect(await processing).toHaveLength(4)
    expect(peak).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(leases.size).toBe(0)
  })

  it('图片下载不占生成锁', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Response.json({ data: [{ url: 'https://img.example/a.png' }] })
      await new Promise(resolve => setTimeout(resolve, 10_000))
      return new Response(png)
    })
    vi.stubGlobal('fetch', fetchMock)
    const processing = Promise.all([generateWithCopilot(input), generateWithCopilot(input)])
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await processing).toHaveLength(2)
  })

  it('接口报错后释放生成锁', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))
      .mockResolvedValueOnce(Response.json({ data: [{ b64_json: png.toString('base64') }] }))
    vi.stubGlobal('fetch', fetchMock)
    const processing = Promise.allSettled([generateWithCopilot(input), generateWithCopilot(input)])
    await vi.advanceTimersByTimeAsync(500)
    expect((await processing).map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(leases.size).toBe(0)
  })

  it('生成超时后持久保护阻止重试和新请求，租约过期也不重复生成', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(Response.json({ data: [{ b64_json: png.toString('base64') }] }))
    vi.stubGlobal('fetch', fetchMock)
    const first = generateWithCopilot(input).catch(error => error)
    await vi.advanceTimersByTimeAsync(COPILOT_TIMEOUT_MS)
    expect(classifyGenerationError(await first, 'copilot')).toMatchObject({ code: 'COPILOT_STATE_UNKNOWN', retry: 'never' })
    expect(inflight.size).toBe(1)
    await vi.advanceTimersByTimeAsync(COPILOT_LEASE_MS + 500)
    await expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    await expect(checkCopilotConnection()).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(leases.size).toBe(0)
  })

  it('300 秒慢请求保持租约并返回原结果，没有超时重试', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 300_000))
      return Response.json({ data: [{ b64_json: png.toString('base64') }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const processing = Promise.all([generateWithCopilot(input), generateWithCopilot(input)])
    await vi.advanceTimersByTimeAsync(180_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(421_000)
    expect(await processing).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(inflight.size).toBe(0)
  })

  it.each(['network', 'gateway'])('不确定的 %s 故障保留保护，后续请求不会出图', async (failure) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (failure === 'network') throw new TypeError('fetch failed')
      return new Response('gateway timeout', { status: 504 })
    }))
    await expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    await expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('进程遗留的持久状态阻止接管后重复出图', async () => {
    const keys = copilotKeys('http://copilot.example:8000')
    leases.set(keys.lease, { token: 'dead-worker', expiresAt: Date.now() - 1 })
    inflight.set(keys.inflight, 'dead-worker')
    vi.stubGlobal('fetch', vi.fn())
    await expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    expect(fetch).not.toHaveBeenCalled()
    expect(inflight.get(keys.inflight)).toBe('dead-worker')
  })

  it('租约丢失时其他 worker 不重复出图，原请求完成后可继续', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 45_000))
      return Response.json({ data: [{ b64_json: png.toString('base64') }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = generateWithCopilot(input)
    await vi.advanceTimersByTimeAsync(1000)
    leases.clear()
    await expect(generateWithCopilot(input)).rejects.toMatchObject({ code: 'COPILOT_STATE_UNKNOWN' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(44_000)
    expect((await first).images[0]?.data).toEqual(png)
    const next = generateWithCopilot(input)
    await vi.advanceTimersByTimeAsync(45_000)
    expect((await next).images[0]?.data).toEqual(png)
    expect(inflight.size).toBe(0)
  })

  it('参考图只在获得锁后复制，停机取消排队且不分配额外 Blob', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    redis.set.mockResolvedValue(null)
    const OriginalBlob = globalThis.Blob
    const blobSpy = vi.fn()
    vi.stubGlobal('Blob', class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); blobSpy() }
    })
    vi.stubGlobal('fetch', vi.fn())
    const generate = prepareCopilotGeneration({ ...input, referenceImages: [{ data: png, mimeType: 'image/png' }] }, { signal: controller.signal })
    const pending = Promise.allSettled(Array.from({ length: 32 }, () => generate()))
    await vi.advanceTimersByTimeAsync(5000)
    expect(blobSpy).not.toHaveBeenCalled()
    controller.abort()
    const results = await pending
    expect(results.every(result => result.status === 'rejected' && result.reason.code === 'WORKER_STOPPING')).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('CDN 短暂 403 只重试下载，不重新生成', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [{ url: 'https://img.example/a.png' }] }))
      .mockResolvedValueOnce(new Response('denied', { status: 403 }))
      .mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)
    const processing = generateWithCopilot(input)
    await vi.advanceTimersByTimeAsync(1000)
    expect((await processing).images[0]).toEqual({ data: png, mimeType: 'image/png' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://copilot.example:8000/v1/images/generations', 'https://img.example/a.png', 'https://img.example/a.png',
    ])
  })

  it.each([401, 403, 404, 429, 503])('CDN 持续 %s 保留下载错误，不误报认证或重试生成', async (status) => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
      ? Response.json({ data: [{ url: 'https://img.example/a.png' }] })
      : new Response('CDN error', { status }))
    vi.stubGlobal('fetch', fetchMock)
    const processing = generateWithCopilot(input).catch(error => error)
    await vi.advanceTimersByTimeAsync(3000)
    const classified = classifyGenerationError(await processing, 'copilot')
    expect(classified).toMatchObject({ code: 'COPILOT_DOWNLOAD_FAILED', retry: 'never' })
    expect(classified.message).toContain(`HTTP ${status}`)
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('CDN 连接异常最多尝试三次', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Response.json({ data: [{ url: 'https://img.example/a.png' }] })
      throw new TypeError('fetch failed', { cause: new Error('ECONNRESET') })
    })
    vi.stubGlobal('fetch', fetchMock)
    const processing = generateWithCopilot(input).catch(error => error)
    await vi.advanceTimersByTimeAsync(3000)
    expect(classifyGenerationError(await processing, 'copilot')).toMatchObject({ code: 'COPILOT_DOWNLOAD_FAILED', retry: 'never' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('下载及重试总计不超过 60 秒，并中止超时连接', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Response.json({ data: [{ url: 'https://img.example/a.png' }] })
      signals.push(options!.signal!)
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    const processing = generateWithCopilot(input).catch(error => error)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(classifyGenerationError(await processing, 'copilot')).toMatchObject({ code: 'COPILOT_DOWNLOAD_FAILED', message: '下载 Copilot 生成图片超时', retry: 'never' })
    expect(signals).toHaveLength(2)
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('Copilot 连接检查', () => {
  it('令牌文件存在时连接正常', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok', token_file: true })))
    await expect(checkCopilotConnection()).resolves.toBeUndefined()
  })

  it('200 但未登录时返回认证错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok', token_file: false })))
    await expect(checkCopilotConnection()).rejects.toMatchObject({ code: 'COPILOT_AUTH_FAILED' })
  })

  it.each([null, {}, { status: 'error', token_file: true }, { status: 'ok', token_file: 'false' }])('拒绝无效健康状态（%#）', async (health) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(health)))
    await expect(checkCopilotConnection()).rejects.toMatchObject({ code: 'COPILOT_UNAVAILABLE' })
  })
})
