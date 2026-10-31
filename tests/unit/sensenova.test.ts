import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ASPECT_RATIOS, IMAGE_SIZES, defaultModel } from '#shared/config/models'
import { SENSENOVA_ASPECT_RATIOS } from '#shared/config/sensenova'
import { checkSenseNovaConnection, generateWithSenseNova, mapDimensions, prepareSenseNovaGeneration } from '#server/services/sensenova'
import { classifyGenerationError } from '#server/services/generationErrors'
import type { SenseNovaImageRequest } from '#server/services/sensenova'

describe('SenseNova 尺寸与能力边界', () => {
  it.each([
    ['1:1', '1K', 1024, 1024],
    ['1:1', '2K', 2048, 2048],
    ['1:1', '4K', 4096, 4096],
    ['16:9', '2K', 2720, 1536],
    ['9:16', '2K', 1536, 2720],
    ['3:2', '2K', 2496, 1664],
  ] as const)('%s @ %s 映射为 %ix%i', (ratio, size, width, height) => {
    expect(mapDimensions(ratio, size)).toEqual({ width, height })
  })

  it('所有公开的比例满足 32 像素对齐、512–4096 范围及 3:1 比例上限', () => {
    for (const ratio of SENSENOVA_ASPECT_RATIOS) {
      const [rw, rh] = ratio.split(':').map(Number) as [number, number]
      for (const size of IMAGE_SIZES) {
        const { width, height } = mapDimensions(ratio, size)
        expect(width % 32).toBe(0)
        expect(height % 32).toBe(0)
        expect(Math.min(width, height)).toBeGreaterThanOrEqual(512)
        expect(Math.max(width, height)).toBeLessThanOrEqual(4096)
        expect(Math.max(width / height, height / width)).toBeLessThanOrEqual(3)
        expect(Math.abs(width / height - rw / rh)).toBeLessThan(0.05)
      }
    }
  })

  it('拒绝超出官方范围的长图比例，模型能力与实际请求保持一致', () => {
    expect(defaultModel('sensenova-u1.5-lite')).toMatchObject({ maxReferenceImages: 5 })
    for (const ratio of ASPECT_RATIOS.filter(item => !SENSENOVA_ASPECT_RATIOS.includes(item))) {
      expect(() => mapDimensions(ratio, '1K')).toThrow('仅支持 1:3 到 3:1')
    }
  })
})

describe('SenseNova 文生图与图生图请求', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const input: SenseNovaImageRequest = { prompt: '保留人物，更换背景', model: 'sensenova-u1.5-lite', aspectRatio: '1:1', imageSize: '2K' }
  const image = Buffer.from('generated-image')
  const reference = { data: Buffer.from('reference-image'), mimeType: 'image/jpeg' }

  const successResponse = () => Response.json({
    data: [{ b64_json: image.toString('base64') }],
    usage: { input_tokens: 8785, output_tokens: 4096 },
  })

  beforeEach(() => {
    vi.stubEnv('SENSENOVA_API_KEY', 'test-key')
    vi.stubEnv('SENSENOVA_BASE_URL', 'https://sensenova.example/v1')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function requestedPayload() {
    return JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))
  }

  it('无参考图走文生图，读取图片和 token 用量', async () => {
    fetchMock.mockResolvedValue(successResponse())
    const result = await generateWithSenseNova(input)
    expect(fetchMock.mock.calls[0]![0]).toBe('https://sensenova.example/v1/images/generations')
    expect(requestedPayload()).toEqual({
      model: input.model, prompt: input.prompt, n: 1, size: '2048x2048',
      output_format: 'png', response_format: 'b64_json', watermark: true, prompt_extend: true,
    })
    expect(result).toMatchObject({ images: [{ data: image, mimeType: 'image/png' }], inputTokens: 8785, outputTokens: 4096 })
  })

  it('5 张参考图走编辑接口，按顺序携带 MIME 类型和完整 Data URL', async () => {
    fetchMock.mockResolvedValue(successResponse())
    const references = [reference, ...Array.from({ length: 4 }, (_, i) => ({ data: Buffer.from(`ref-${i}`), mimeType: 'image/png' }))]
    await generateWithSenseNova({ ...input, referenceImages: references })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://sensenova.example/v1/images/edits')
    expect(requestedPayload().images).toEqual(references.map(item => ({ image_url: `data:${item.mimeType};base64,${item.data.toString('base64')}` })))
    expect(requestedPayload().images[0]).toEqual({ image_url: 'data:image/jpeg;base64,cmVmZXJlbmNlLWltYWdl' })
  })

  it('超过 5 张参考图时在调用上游之前拒绝', async () => {
    await expect(generateWithSenseNova({ ...input, referenceImages: Array.from({ length: 6 }, () => reference) })).rejects.toMatchObject({ code: 'TOO_MANY_REFERENCES', statusCode: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('并发生成和失败重试复用序列化请求，各请求有独立的取消信号', async () => {
    const data = Buffer.from('reference-original')
    const encode = vi.spyOn(data, 'toString')
    const generate = prepareSenseNovaGeneration({ ...input, referenceImages: [{ data, mimeType: 'image/jpeg' }] })
    expect(encode).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'busy' } }, { status: 429 }))
      .mockImplementation(async () => successResponse())
    const outcomes = await Promise.allSettled([generate(), generate(), generate(), generate()])
    expect(outcomes[0]!.status).toBe('rejected')
    expect(outcomes.slice(1).every(item => item.status === 'fulfilled')).toBe(true)
    // 原始 Buffer 变化不会修改同一任务已准备好的请求。
    data.fill(0)
    await generate()
    expect(encode).toHaveBeenCalledTimes(1)
    const requests = fetchMock.mock.calls.map(call => call[1]!)
    expect(new Set(requests.map(request => request.body)).size).toBe(1)
    expect(new Set(requests.map(request => request.signal)).size).toBe(5)
    expect(requestedPayload().images[0].image_url).toBe(`data:image/jpeg;base64,${Buffer.from('reference-original').toString('base64')}`)
  })

  it('兼容 URL 响应，下载并保留图片类型', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ url: 'https://cdn.example/image.webp' }] }))
      .mockResolvedValueOnce(new Response(image, { headers: { 'content-type': 'image/webp' } }))
    const result = await generateWithSenseNova({ ...input, referenceImages: [reference] })
    expect(fetchMock.mock.calls[1]![0]).toBe('https://cdn.example/image.webp')
    expect(result.images[0]).toEqual({ data: image, mimeType: 'image/webp' })
  })

  it('兼容 base64 图片响应', async () => {
    fetchMock.mockResolvedValue(successResponse())
    const result = await generateWithSenseNova(input)
    expect(result.images[0]!.data).toEqual(image)
  })

  it('空响应不会被当作成功', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }))
    await expect(generateWithSenseNova(input)).rejects.toMatchObject({ code: 'NO_IMAGE_RETURNED' })
  })

  it('缺少配置时不发请求', async () => {
    vi.stubEnv('SENSENOVA_API_KEY', '')
    await expect(generateWithSenseNova(input)).rejects.toMatchObject({ code: 'SENSENOVA_NOT_CONFIGURED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('认证失败提示检查商汤密钥，错误重复分类保持一致', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }))
    const error = await generateWithSenseNova({ ...input, referenceImages: [reference] }).catch(failure => failure)
    const classified = classifyGenerationError(error)
    expect(classified).toMatchObject({ code: 'SENSENOVA_AUTH_FAILED', retry: 'never' })
    expect(classified.message).toContain('SENSENOVA_API_KEY')
    expect(classified.message).not.toContain('gcloud')
    expect(classifyGenerationError(Object.assign(new Error(classified.message), { code: classified.code }))).toEqual(classified)
  })
})

describe('SenseNova 完整请求超时', () => {
  const input: SenseNovaImageRequest = { prompt: 'a cat', model: 'sensenova-u1.5-lite', aspectRatio: '1:1', imageSize: '2K' }

  function stalledResponse(status = 200) {
    return new Response(new ReadableStream({ start() {} }), { status })
  }

  beforeEach(() => vi.stubEnv('SENSENOVA_API_KEY', 'test-key'))

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each([200, 500])('收到 HTTP %s 响应头后，卡住的响应体仍会超时并中止连接', async (status) => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(stalledResponse(status))
    vi.stubGlobal('fetch', fetchMock)
    const failure = expect(generateWithSenseNova(input)).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(120_000)
    await failure
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('图片下载的响应体卡住时也会超时并中止连接', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [{ url: 'https://example.com/image.png' }] }))
      .mockResolvedValueOnce(stalledResponse())
    vi.stubGlobal('fetch', fetchMock)
    const failure = expect(generateWithSenseNova(input)).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    await failure
    expect((fetchMock.mock.calls[1]![1] as RequestInit).signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('健康检查的错误响应体也受超时限制', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(stalledResponse(401))
    vi.stubGlobal('fetch', fetchMock)
    const failure = expect(checkSenseNovaConnection()).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(8_000)
    await failure
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
