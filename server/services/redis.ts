import Redis from 'ioredis'
import { getServerConfig } from '#server/utils/config'

let client: Redis | undefined

export function getRedis() {
  if (!client) {
    const config = getServerConfig().redis
    client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true,
      connectTimeout: 2500,
      maxRetriesPerRequest: 1,
      retryStrategy: attempts => Math.min(attempts * 250, 2000),
    })
    client.on('error', () => {})
  }
  return client
}

export async function connectRedis() {
  const redis = getRedis()
  if (redis.status === 'wait') await redis.connect()
  await redis.ping()
  return redis
}

export async function closeRedis() {
  if (client && client.status !== 'end') await client.quit()
  client = undefined
}
