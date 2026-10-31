import { describe, expect, it, vi } from 'vitest'
import { consumeGenerationQueue } from '#server/services/generationConsumer'

vi.mock('#server/services/generation', () => ({ GENERATION_QUEUE: 'test:queue:v2' }))

describe('worker 排空', () => {
  it('停机时仍在 BRPOP 的 consumer 将弹出的任务原样放回，不再领取', async () => {
    let stopping = false
    const entry = JSON.stringify({ generationId: '123' })
    const redis = {
      brpop: vi.fn(async () => {
        stopping = true
        return ['test:queue:v2', entry] as [string, string]
      }),
      rpush: vi.fn(async () => 1),
    }
    const runTask = vi.fn()
    await consumeGenerationQueue(redis, { isStopping: () => stopping, runTask, onError: vi.fn() })
    expect(runTask).not.toHaveBeenCalled()
    expect(redis.rpush).toHaveBeenCalledWith('test:queue:v2', entry)
    expect(redis.brpop).toHaveBeenCalledTimes(1)
  })

  it('停机等待正在执行的任务完成，完成后不再弹出下一项', async () => {
    let stopping = false
    let complete!: () => void
    const task = new Promise<void>(resolve => { complete = resolve })
    const redis = { brpop: vi.fn(async () => ['test:queue:v2', '123'] as [string, string]), rpush: vi.fn() }
    const runTask = vi.fn(() => { stopping = true; return task })
    let drained = false
    const consumer = consumeGenerationQueue(redis, { isStopping: () => stopping, runTask, onError: vi.fn() }).then(() => { drained = true })
    await vi.waitFor(() => expect(runTask).toHaveBeenCalledWith('123'))
    expect(drained).toBe(false)
    complete()
    await consumer
    expect(drained).toBe(true)
    expect(redis.brpop).toHaveBeenCalledTimes(1)
    expect(redis.rpush).not.toHaveBeenCalled()
  })

  it('初始化期间已收到停机信号时不访问队列', async () => {
    const redis = { brpop: vi.fn(), rpush: vi.fn() }
    await consumeGenerationQueue(redis, { isStopping: () => true, runTask: vi.fn(), onError: vi.fn() })
    expect(redis.brpop).not.toHaveBeenCalled()
  })
})
