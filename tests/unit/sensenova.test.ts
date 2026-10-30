import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkSenseNovaConnection, generateWithSenseNova, mapDimensions } from '#server/services/sensenova'
import { classifyGenerationError } from '#server/services/generationErrors'

const input = { prompt: 'a cat', model: 'sensenova-u1-fast', aspectRatio: '1:1', imageSize: '2K' } as const

beforeEach(() => vi.stubEnv('SENSENOVA_API_KEY', 'test-key'))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SenseNova 官方尺寸与能力边界', () => {
  it.each([
    ['1:1', '1K', 1344, 1344],
    ['1:1', '2K', 2048, 2048],
    ['16:9', '1K', 1792, 992],
    ['16:9', '2K', 2752, 1536],
    ['2:3', '2K', 1664, 2496],
    ['3:2', '2K', 2496, 1664],
  ] as const)('%s @ %s 使用官方尺寸 %s×%s', (ratio, size, width, height) => {
    expect(mapDimensions(ratio, size)).toEqual({ width, height })
  })

  it('拒绝 4K，不用 2K 图片冒充 4K', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(generateWithSenseNova({ ...input, imageSize: '4K' })).rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE_SIZE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['21:9', '1:4', '4:1', '1:8', '8:1'] as const)('拒绝不支持的比例 %s', (ratio) => {
    expect(() => mapDimensions(ratio, '2K')).toThrow('不支持该画布比例')
  })
})

describe('SenseNova 请求与响应', () => {
  it('发送官方尺寸并完整下载 URL 图片', async () => {
    const image = Buffer.from('test-image')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [{ url: 'https://example.com/image.png', revised_prompt: 'a painted cat' }] }))
      .mockResolvedValueOnce(new Response(image, { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateWithSenseNova(input)
    const request = fetchMock.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(request.body as string)).toEqual({ model: input.model, prompt: input.prompt, n: 1, size: '2048x2048', response_format: 'url' })
    expect(result.images).toEqual([{ data: image, mimeType: 'image/png' }])
    expect(result.text).toBe('a painted cat')
  })

  it('兼容 base64 图片响应', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: Buffer.from('image').toString('base64') }] })))
    const result = await generateWithSenseNova(input)
    expect(result.images[0]!.data).toEqual(Buffer.from('image'))
  })

  it('认证失败给出商汤配置提示', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'Invalid API key' } }, { status: 401 })))
    const error = await generateWithSenseNova(input).catch(error => error)
    expect(error.code).toBe('SENSENOVA_AUTH_FAILED')
    const classified = classifyGenerationError(error, 'sensenova')
    expect(classified).toMatchObject({ code: 'SENSENOVA_AUTH_FAILED', retry: 'never' })
    expect(classified.message).toContain('SENSENOVA_API_KEY')
    expect(classified.message).not.toContain('gcloud')
  })

  it('空响应不会被当作成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [] })))
    await expect(generateWithSenseNova(input)).rejects.toMatchObject({ code: 'NO_IMAGE_RETURNED' })
  })
})

describe('SenseNova 完整请求超时', () => {
  function stalledResponse(status = 200) {
    return new Response(new ReadableStream({ start() {} }), { status })
  }

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
  })
})
