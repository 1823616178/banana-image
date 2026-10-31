import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { processGeneration } from '#server/services/generationWorker'

const mocks = vi.hoisted(() => ({
  generationRepository: { findOneBy: vi.fn(), update: vi.fn() },
  imageRepository: { findBy: vi.fn(), findOneBy: vi.fn(), create: vi.fn(), save: vi.fn() },
  source: { getRepository: vi.fn(), query: vi.fn() },
  readStoredImage: vi.fn(),
  saveImage: vi.fn(),
  generateWithVertex: vi.fn(),
}))

vi.mock('#server/db/data-source', () => ({ initializeDatabase: async () => mocks.source }))
vi.mock('#server/services/generation', () => ({ GENERATION_QUEUE: 'test:queue', setTaskStatus: vi.fn() }))
vi.mock('#server/services/images', () => ({ purgeDeletedDuplicate: vi.fn() }))
vi.mock('#server/services/rateLimit', () => ({ recordDailyCost: vi.fn() }))
vi.mock('#server/services/redis', () => ({ getRedis: () => ({ scan: async () => ['0', []], set: async () => 'OK', eval: async () => 1 }) }))
vi.mock('#server/services/settings', () => ({
  getSettingsMap: async () => ({}),
  settingValue: (_settings: unknown, _key: string, fallback: unknown) => fallback,
}))
vi.mock('#server/services/storage', () => ({
  readStoredImage: mocks.readStoredImage,
  saveImage: mocks.saveImage,
  deleteStoredFiles: vi.fn(),
}))
vi.mock('#server/services/vertex', () => ({ generateWithVertex: mocks.generateWithVertex }))

describe('Worker 参考图传递', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const task = {
    id: '100', userId: '1', status: 'running', model: 'sensenova-u1.5-lite',
    refImageIds: ['11', '12'], finalPrompt: '保留人像，替换背景', aspectRatio: '1:1', imageSize: '2K', count: 1,
  }
  const generated = Buffer.from('generated-image')

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('SENSENOVA_API_KEY', 'test-key')
    vi.stubEnv('SENSENOVA_BASE_URL', 'https://sensenova.example/v1')
    mocks.source.getRepository.mockImplementation(entity => entity === Generation ? mocks.generationRepository : mocks.imageRepository)
    mocks.generationRepository.findOneBy.mockResolvedValue(task)
    // 数据库返回顺序与用户选择顺序不同；第一张主编辑图必须保持为 11。
    mocks.imageRepository.findBy.mockResolvedValue([
      { id: '12', filePath: 'second.png', storage: 'local', mimeType: 'image/png' },
      { id: '11', filePath: 'main.jpg', storage: 'ftp', mimeType: 'image/jpeg' },
    ])
    mocks.imageRepository.findOneBy.mockResolvedValue(null)
    mocks.imageRepository.create.mockImplementation(value => value)
    mocks.imageRepository.save.mockImplementation(async value => ({ ...value, id: '20' }))
    mocks.readStoredImage.mockImplementation(async path => ({ data: Buffer.from(path) }))
    mocks.saveImage.mockResolvedValue({ sha256: 'unique-hash', filePath: 'generated.png', thumbPath: 'generated.webp', storage: 'local' })
    fetchMock.mockResolvedValue(Response.json({ data: [{ b64_json: generated.toString('base64') }], usage: { input_tokens: 100, output_tokens: 200 } }))
    mocks.generateWithVertex.mockResolvedValue({ images: [{ data: generated, mimeType: 'image/png' }], text: '', finishReasons: ['STOP'], inputTokens: 10, outputTokens: 20 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('从 FTP / 本地加载参考图，以用户顺序调用商汤编辑接口并保存结果', async () => {
    expect(await processGeneration(task.id)).toBe('succeeded')
    expect(mocks.source.getRepository).toHaveBeenCalledWith(Image)
    expect(mocks.imageRepository.findBy).toHaveBeenCalledWith(expect.objectContaining({ userId: task.userId }))
    expect(mocks.readStoredImage).toHaveBeenNthCalledWith(1, 'main.jpg', 'ftp')
    expect(mocks.readStoredImage).toHaveBeenNthCalledWith(2, 'second.png', 'local')
    expect(fetchMock.mock.calls[0]![0]).toBe('https://sensenova.example/v1/images/edits')
    const payload = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))
    expect(payload.images).toEqual([
      { image_url: `data:image/jpeg;base64,${Buffer.from('main.jpg').toString('base64')}` },
      { image_url: `data:image/png;base64,${Buffer.from('second.png').toString('base64')}` },
    ])
    expect(mocks.generateWithVertex).not.toHaveBeenCalled()
    expect(mocks.saveImage).toHaveBeenCalledWith(generated, 'generated')
    expect(mocks.generationRepository.update).toHaveBeenCalledWith({ id: task.id }, expect.objectContaining({ status: 'succeeded', inputTokens: 100, outputTokens: 200 }))
  })

  it('Vertex 任务继续收到完整参考图', async () => {
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, model: 'gemini-3-pro-image' })
    expect(await processGeneration(task.id)).toBe('succeeded')
    expect(mocks.generateWithVertex).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro-image',
      referenceImages: [
        { data: Buffer.from('main.jpg'), mimeType: 'image/jpeg' },
        { data: Buffer.from('second.png'), mimeType: 'image/png' },
      ],
    }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Copilot 任务使用独立供应商并记录零费用', async () => {
    vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000')
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, model: 'copilot-image', refImageIds: [], imageSize: '1K' })
    expect(await processGeneration(task.id)).toBe('succeeded')
    expect(fetchMock.mock.calls[0]![0]).toBe('http://copilot.example:8000/v1/images/generations')
    expect(mocks.generateWithVertex).not.toHaveBeenCalled()
    expect(mocks.generationRepository.update).toHaveBeenCalledWith({ id: task.id }, expect.objectContaining({ status: 'succeeded', costUsd: '0.0000' }))
  })

  it('Copilot 下载失败只重试下载，不重新调用生成接口', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000')
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, model: 'copilot-image', refImageIds: [], imageSize: '1K' })
    fetchMock.mockImplementation(async (_url, options) => options?.method === 'POST'
      ? Response.json({ data: [{ url: 'https://img.example/a.png' }] })
      : new Response('denied', { status: 403 }))
    const processing = processGeneration(task.id)
    await vi.advanceTimersByTimeAsync(3000)
    expect(await processing).toBe('failed')
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(mocks.generationRepository.update).toHaveBeenCalledWith({ id: task.id }, expect.objectContaining({ errorMessage: expect.stringContaining('下载 Copilot 生成图片失败 (HTTP 403)') }))
    expect(mocks.saveImage).not.toHaveBeenCalled()
  })

  it('四张并发生成及上游重试仅编码每张参考图一次', async () => {
    vi.useFakeTimers()
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, count: 4 })
    const referenceData = [Buffer.from('main.jpg'), Buffer.from('second.png')]
    const encoders = referenceData.map(data => vi.spyOn(data, 'toString'))
    mocks.readStoredImage.mockResolvedValueOnce({ data: referenceData[0] }).mockResolvedValueOnce({ data: referenceData[1] })
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'busy' } }, { status: 429 }))
      .mockImplementation(async () => Response.json({ data: [{ b64_json: generated.toString('base64') }] }))
    const processing = processGeneration(task.id)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await processing).toBe('succeeded')
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(mocks.saveImage).toHaveBeenCalledTimes(4)
    for (const encoder of encoders) expect(encoder).toHaveBeenCalledTimes(1)
  })
})
