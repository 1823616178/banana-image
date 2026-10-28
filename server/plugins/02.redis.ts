import { connectRedis } from '#server/services/redis'
import { withTimeout } from '#server/utils/async'
import { logCaughtError } from '#server/utils/errors'

export default defineNitroPlugin(async () => {
  try {
    await withTimeout(connectRedis(), 4000, 'Redis 连接超时')
    console.info('[banana-image] Redis connected')
  } catch (error) {
    logCaughtError('banana-image redis', error)
  }
})
