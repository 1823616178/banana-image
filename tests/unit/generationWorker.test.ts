import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { processGeneration } from '#server/services/generationWorker'
import { copilotRedis, resetCopilotRedis } from '../helpers/copilotRedis'
import { setTaskStatus } from '#server/services/generation'
import { recordDailyCost } from '#server/services/rateLimit'

const mocks = vi.hoisted(() => ({
  generationRepository: { findOneBy: vi.fn(), update: vi.fn() },
  imageRepository: { find: vi.fn(), findBy: vi.fn(), findOneBy: vi.fn(), create: vi.fn(), save: vi.fn() },
  source: { getRepository: vi.fn(), query: vi.fn() },
  readStoredImage: vi.fn(),
  saveImage: vi.fn(),
  generateWithVertex: vi.fn(),
}))

vi.mock('#server/db/data-source', () => ({ initializeDatabase: async () => mocks.source }))
vi.mock('#server/services/generation', () => ({ GENERATION_QUEUE: 'test:queue', setTaskStatus: vi.fn() }))
vi.mock('#server/services/images', () => ({ purgeDeletedDuplicate: vi.fn() }))
vi.mock('#server/services/rateLimit', () => ({ recordDailyCost: vi.fn() }))
vi.mock('#server/services/redis', async () => {
  const { copilotRedis } = await import('../helpers/copilotRedis')
  return { getRedis: () => copilotRedis }
})
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
    resetCopilotRedis()
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
    mocks.imageRepository.find.mockResolvedValue([])
    mocks.imageRepository.create.mockImplementation(value => value)
    let nextImageId = 20
    mocks.imageRepository.save.mockImplementation(async value => ({ ...value, id: String(nextImageId++) }))
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

  it('第一张生成完成后立即保存，不等待其余图片', async () => {
    vi.useFakeTimers()
    vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000')
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, model: 'copilot-image', refImageIds: [], imageSize: '1K', count: 4 })
    fetchMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 120_000))
      return Response.json({ data: [{ b64_json: generated.toString('base64') }] })
    })
    const processing = processGeneration(task.id)
    await vi.advanceTimersByTimeAsync(121_000)
    expect(mocks.saveImage).toHaveBeenCalledTimes(1)
    expect(setTaskStatus).toHaveBeenCalledWith(task.id, 'running', 25)
    await vi.advanceTimersByTimeAsync(365_000)
    expect(await processing).toBe('succeeded')
  })

  it('停机取消等待中的出图，保存正在执行的图片并重新入队；重启仅补齐剩余张数', async () => {
    vi.useFakeTimers()
    vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000')
    const controller = new AbortController()
    const copilotTask = { ...task, model: 'copilot-image', refImageIds: [], imageSize: '1K', count: 4 }
    mocks.generationRepository.findOneBy.mockResolvedValue(copilotTask)
    fetchMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 120_000))
      return Response.json({ data: [{ b64_json: generated.toString('base64') }] })
    })
    const processing = processGeneration(task.id, { signal: controller.signal })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    controller.abort()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(await processing).toBe('queued')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.saveImage).toHaveBeenCalledTimes(1)
    expect(copilotRedis.lpush).toHaveBeenCalledWith('test:queue', JSON.stringify({ generationId: task.id }))
    expect(mocks.generationRepository.update).toHaveBeenLastCalledWith({ id: task.id }, expect.objectContaining({ status: 'queued', attemptCount: expect.any(Function) }))
    expect(recordDailyCost).not.toHaveBeenCalled()

    mocks.imageRepository.find.mockResolvedValue([{ id: '20', generationId: task.id }])
    fetchMock.mockImplementation(async () => Response.json({ data: [{ b64_json: generated.toString('base64') }] }))
    const resumed = processGeneration(task.id)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await resumed).toBe('succeeded')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(mocks.saveImage).toHaveBeenCalledTimes(4)
    expect(mocks.source.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO usage_stats'), expect.arrayContaining(['copilot-image', 4]))
  })

  it('所有图片已保存时直接完成，不重新生成或读取参考图', async () => {
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, count: 2, inputTokens: 200, outputTokens: 400 })
    mocks.imageRepository.find.mockResolvedValue([{ id: '20' }, { id: '21' }])
    expect(await processGeneration(task.id)).toBe('succeeded')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.readStoredImage).not.toHaveBeenCalled()
    expect(mocks.saveImage).not.toHaveBeenCalled()
    expect(mocks.generationRepository.update).toHaveBeenLastCalledWith({ id: task.id }, expect.objectContaining({ status: 'succeeded', inputTokens: 200, outputTokens: 400 }))
  })

  it('两个四张任务停机时只排空当前一张，不等待全部八张串行执行', async () => {
    vi.useFakeTimers()
    vi.stubEnv('COPILOT_BASE_URL', 'http://copilot.example:8000')
    const controller = new AbortController()
    mocks.generationRepository.findOneBy.mockImplementation(async ({ id }) => ({ ...task, id, model: 'copilot-image', refImageIds: [], imageSize: '1K', count: 4 }))
    fetchMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 120_000))
      return Response.json({ data: [{ b64_json: generated.toString('base64') }] })
    })
    const processing = Promise.all(['100', '101'].map(id => processGeneration(id, { signal: controller.signal })))
    await vi.advanceTimersByTimeAsync(1000)
    controller.abort()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(await processing).toEqual(['queued', 'queued'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.saveImage).toHaveBeenCalledTimes(1)
    expect(copilotRedis.lpush).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('恢复已有检查点时保留已记录的 tokens，只生成剩余张数', async () => {
    mocks.generationRepository.findOneBy.mockResolvedValue({ ...task, count: 2, inputTokens: 100, outputTokens: 200 })
    mocks.imageRepository.find.mockResolvedValue([{ id: '19' }])
    expect(await processGeneration(task.id)).toBe('succeeded')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.generationRepository.update).toHaveBeenLastCalledWith({ id: task.id }, expect.objectContaining({ inputTokens: 200, outputTokens: 400 }))
  })

  it('已停机且未开始的任务立即回队，不消耗生成次数', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await processGeneration(task.id, { signal: controller.signal })).toBe('queued')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.saveImage).not.toHaveBeenCalled()
  })
})
