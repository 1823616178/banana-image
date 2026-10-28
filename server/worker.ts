import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import type Redis from 'ioredis'

if (existsSync('.env')) process.loadEnvFile('.env')

const { initializeDatabase, dataSource } = await import('#server/db/data-source')
const { GENERATION_QUEUE, setTaskStatus } = await import('#server/services/generation')
const { processGeneration, recoverGenerationQueue } = await import('#server/services/generationWorker')
const { classifyGenerationError } = await import('#server/services/generationErrors')
const { logCaughtError } = await import('#server/utils/errors')
const { connectRedis, getRedis, closeRedis } = await import('#server/services/redis')
const { Generation } = await import('#server/db/entities/Generation')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const workerName = `${hostname()}:${process.pid}`
let stopping = false

function generationId(entry: string) {
  try {
    const id = String(JSON.parse(entry).generationId ?? '')
    return /^\d+$/.test(id) ? id : null
  } catch {
    return /^\d+$/.test(entry) ? entry : null
  }
}

async function releaseLock(id: string, token: string) {
  await getRedis().eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end', 1, `bi:lock:gen:${id}`, token).catch((error) => {
    logCaughtError(`worker generation ${id} lock`, error)
  })
}

async function runTask(id: string, consumerId: string) {
  const lockKey = `bi:lock:gen:${id}`
  const token = randomUUID()
  const locked = await getRedis().set(lockKey, token, 'PX', 300_000, 'NX')
  if (!locked) return

  const source = await initializeDatabase()
  const repository = source.getRepository(Generation)
  const now = new Date()
  const claimed = await repository.createQueryBuilder().update(Generation).set({
    status: 'running',
    workerId: consumerId,
    lockedAt: now,
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + 90_000),
    attemptCount: () => 'attemptCount + 1',
    version: () => 'version + 1',
    errorCode: null,
    errorMessage: null,
  }).where('id = :id AND status = :status', { id, status: 'queued' }).execute()
  if (!claimed.affected) {
    await releaseLock(id, token)
    return
  }

  const generation = await repository.findOneBy({ id })
  if (!generation || generation.attemptCount > generation.maxAttempts) {
    await repository.update({ id }, { status: 'failed', errorCode: 'MAX_ATTEMPTS_EXCEEDED', errorMessage: '任务超过最大执行次数', workerId: null, leaseExpiresAt: null })
    await setTaskStatus(id, 'failed', 100, '任务超过最大执行次数')
    console.error(`[worker] generation ${id} exceeded max attempts`)
    await releaseLock(id, token)
    return
  }

  await setTaskStatus(id, 'running', 0)
  const heartbeat = setInterval(() => {
    const expiresAt = new Date(Date.now() + 90_000)
    void Promise.all([
      repository.update({ id, workerId: consumerId }, { heartbeatAt: new Date(), leaseExpiresAt: expiresAt }),
      getRedis().eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end', 1, lockKey, token, '300000'),
    ]).catch((error) => {
      logCaughtError(`worker generation ${id} heartbeat`, error)
    })
  }, 20_000)

  try {
    const status = await processGeneration(id)
    if (status) console.info(`[worker] generation ${id} ${status}`)
  } catch (error) {
    const classified = classifyGenerationError(error)
    await repository.update({ id }, { status: 'failed', errorCode: classified.code, errorMessage: classified.message, workerId: null, lockedAt: null, heartbeatAt: null, leaseExpiresAt: null })
    await setTaskStatus(id, 'failed', 100, classified.message)
    logCaughtError(`worker generation ${id}`, error)
  } finally {
    clearInterval(heartbeat)
    await releaseLock(id, token)
  }
}

async function consume(index: number, clients: Redis[]) {
  const consumerId = `${workerName}:${index}`
  const redis = getRedis().duplicate({ maxRetriesPerRequest: null })
  clients.push(redis)
  await redis.connect()
  while (!stopping) {
    try {
      const result = await redis.brpop(GENERATION_QUEUE, 5)
      if (!result) continue
      const id = generationId(result[1])
      if (id) await runTask(id, consumerId)
      else console.error('[worker] discarded malformed queue entry')
    } catch (error) {
      logCaughtError(`worker consumer ${index}`, error)
      if (!stopping) await delay(2000)
    }
  }
}

async function main() {
  await initializeDatabase()
  await connectRedis()
  await recoverGenerationQueue()
  const config = await import('#server/utils/config').then(module => module.getServerConfig())
  const clients: Redis[] = []
  const consumers = Array.from({ length: config.workerConcurrency }, (_, index) => consume(index + 1, clients))
  let recovering = false
  const recovery = setInterval(() => {
    if (recovering || stopping) return
    recovering = true
    void recoverGenerationQueue().catch(error => logCaughtError('worker recovery', error)).finally(() => { recovering = false })
  }, 60_000)

  console.info(`[worker] ${workerName} started with concurrency ${config.workerConcurrency}`)
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    clearInterval(recovery)
    await Promise.all(consumers)
    for (const client of clients) client.disconnect()
    await closeRedis()
    if (dataSource.isInitialized) await dataSource.destroy()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}

void main().catch((error) => {
  logCaughtError('worker startup', error)
  process.exit(1)
})
