import type { HealthCheck, HealthDto } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { connectRedis } from '#server/services/redis'
import { checkFtpConnection } from '#server/services/ftp'
import { getServerConfig } from '#server/utils/config'
import { checkVertexConnection } from '#server/services/vertex'
import { withTimeout } from '#server/utils/async'
import { errorMessage, logCaughtError } from '#server/utils/errors'
import { respond } from '#server/utils/response'

async function check(action: () => Promise<unknown>): Promise<HealthCheck> {
  const startedAt = performance.now()
  try {
    await withTimeout(Promise.resolve(action()), 5000, '连接检查超时')
    return { status: 'ok', message: '连接正常', latencyMs: Math.round(performance.now() - startedAt) }
  } catch (error) {
    logCaughtError('health', error)
    return { status: 'error', message: errorMessage(error).slice(0, 300), latencyMs: Math.round(performance.now() - startedAt) }
  }
}

export default defineEventHandler(event => respond<HealthDto>(event, async () => {
  const ftpEnabled = getServerConfig().ftp.enabled
  const [database, redis, vertex, ftp] = await Promise.all([
    check(async () => (await initializeDatabase()).query('SELECT 1')),
    check(async () => (await connectRedis()).ping()),
    check(checkVertexConnection),
    ftpEnabled ? check(checkFtpConnection) : Promise.resolve<HealthCheck>({ status: 'disabled', message: '未配置 FTP_HOST', latencyMs: 0 }),
  ])
  return { database, redis, vertex, ftp }
}))
