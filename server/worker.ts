import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import type Redis from 'ioredis'

let stopping = false
const shutdown = new AbortController()
const requestShutdown = () => { stopping = true; shutdown.abort() }
// 初始化过程中收到退出信号也先停止领任务，再关闭资源。
process.once('SIGINT', requestShutdown)
process.once('SIGTERM', requestShutdown)

if (existsSync('.env')) process.loadEnvFile('.env')

const { initializeDatabase, dataSource } = await import('#server/db/data-source')
const { setTaskStatus } = await import('#server/services/generation')
const { consumeGenerationQueue } = await import('#server/services/generationConsumer')
const { processGeneration, recoverGenerationQueue } = await import('#server/services/generationWorker')
const { classifyGenerationError } = await import('#server/services/generationErrors')
const { logCaughtError } = await import('#server/utils/errors')
const { connectRedis, getRedis, closeRedis } = await import('#server/services/redis')
const { Generation } = await import('#server/db/entities/Generation')

const workerName = `${hostname()}:${process.pid}`

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
    const status = await processGeneration(id, { signal: shutdown.signal })
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
  await consumeGenerationQueue(redis, {
    isStopping: () => stopping,
    runTask: id => runTask(id, consumerId),
    onError: error => logCaughtError(`worker consumer ${index}`, error),
  })
}

async function main() {
  const clients: Redis[] = []
  let recovery: ReturnType<typeof setInterval> | undefined
  let recovering: Promise<void> | undefined
  try {
    await initializeDatabase()
    await connectRedis()
    if (stopping) return
    await recoverGenerationQueue()
    if (stopping) return
    const config = await import('#server/utils/config').then(module => module.getServerConfig())
    const consumers = Array.from({ length: config.workerConcurrency }, (_, index) => consume(index + 1, clients))
    recovery = setInterval(() => {
      if (recovering || stopping) return
      recovering = recoverGenerationQueue()
        .catch(error => logCaughtError('worker recovery', error))
        .finally(() => { recovering = undefined })
    }, 60_000)

    console.info(`[worker] ${workerName} started with concurrency ${config.workerConcurrency}`)
    // 即使一个 consumer 初始化失败，也先排空其他 consumer 已开始的任务。
    const outcomes = await Promise.allSettled(consumers.map(consumer => consumer.catch(error => {
      requestShutdown()
      throw error
    })))
    const failure = outcomes.find(outcome => outcome.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  } finally {
    requestShutdown()
    clearInterval(recovery)
    await recovering
    for (const client of clients) client.disconnect()
    await import('#server/services/copilot').then(module => module.closeCopilotConnections())
    await closeRedis()
    if (dataSource.isInitialized) await dataSource.destroy()
  }
}

void main().then(() => process.exit(0)).catch((error) => {
  logCaughtError('worker startup', error)
  process.exit(1)
})
