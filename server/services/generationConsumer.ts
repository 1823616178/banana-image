import type Redis from 'ioredis'
import { GENERATION_QUEUE } from '#server/services/generation'

function generationId(entry: string) {
  if (/^\d+$/.test(entry)) return entry
  try {
    const id = String(JSON.parse(entry).generationId ?? '')
    return /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** 停机期间弹出的任务放回队头，已开始的任务由调用方等待完成。 */
export async function consumeGenerationQueue(redis: Pick<Redis, 'brpop' | 'rpush'>, options: {
  isStopping: () => boolean
  runTask: (id: string) => Promise<void>
  onError: (error: unknown) => void
}) {
  while (!options.isStopping()) {
    try {
      const result = await redis.brpop(GENERATION_QUEUE, 5)
      if (!result) continue
      if (options.isStopping()) {
        await redis.rpush(GENERATION_QUEUE, result[1])
        return
      }
      const id = generationId(result[1])
      if (id) await options.runTask(id)
      else options.onError(new Error('Discarded malformed queue entry'))
    } catch (error) {
      options.onError(error)
      if (!options.isStopping()) await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
