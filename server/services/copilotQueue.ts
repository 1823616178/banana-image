import { createHash, randomUUID } from 'node:crypto'
import { COPILOT_MAX_REFERENCE_IMAGES } from '#shared/config/copilot'
import { getRedis } from '#server/services/redis'
import { AppError, logCaughtError } from '#server/utils/errors'

// 上游每次生成最多 900s，每张参考图上传最多 120s，认证恢复最多执行两次。
export const COPILOT_TIMEOUT_MS = 2 * (900_000 + COPILOT_MAX_REFERENCE_IMAGES * 120_000) + 120_000
export const COPILOT_DOWNLOAD_TIMEOUT_MS = 60_000
export const COPILOT_LEASE_MS = 30_000

export function copilotKeys(endpoint: string) {
  const hash = createHash('sha256').update(new URL(endpoint).origin).digest('hex')
  return { lease: `bi:lock:copilot:${hash}`, inflight: `bi:copilot:inflight:${hash}` }
}

function unknownState(key: string, cause?: unknown) {
  return new AppError('COPILOT_STATE_UNKNOWN', 'Copilot 上一次生成的结果无法确认，已暂停后续生成以避免重复出图，请联系管理员检查上游任务', 503, { stateKey: key }, { cause })
}

function checkStopping(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError('WORKER_STOPPING', '任务将在服务重启后继续', 503)
}

async function waitForSlot(signal?: AbortSignal) {
  checkStopping(signal)
  await new Promise<void>((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', abort); resolve() }
    const timer = setTimeout(finish, 500)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(new AppError('WORKER_STOPPING', '任务将在服务重启后继续', 503))
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}

export async function checkCopilotState(endpoint: string) {
  const keys = copilotKeys(endpoint)
  if (Number(await getRedis().eval('return redis.call("exists", KEYS[1]) == 1 and redis.call("exists", KEYS[2]) == 0 and 1 or 0', 2, keys.inflight, keys.lease))) {
    throw unknownState(keys.inflight)
  }
}

/** 短租约用于检测进程存活；持久状态只在明确收到上游结果后清除。 */
export async function withCopilotSlot<T>(endpoint: string, signal: AbortSignal | undefined, action: (slot: { start: () => Promise<void>, complete: () => void }) => Promise<T>): Promise<T> {
  const redis = getRedis()
  const keys = copilotKeys(endpoint)
  const token = randomUUID()
  while (true) {
    checkStopping(signal)
    if (await redis.set(keys.lease, token, 'PX', COPILOT_LEASE_MS, 'NX') === 'OK') break
    await waitForSlot(signal)
  }

  let started = false
  let completed = false
  let renewing: Promise<unknown> | undefined
  const heartbeat = setInterval(() => {
    if (renewing) return
    renewing = redis.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end', 1, keys.lease, token, COPILOT_LEASE_MS)
      .catch(error => logCaughtError('copilot renew lease', error))
      .finally(() => { renewing = undefined })
  }, COPILOT_LEASE_MS / 3)

  try {
    checkStopping(signal)
    if (await redis.get(keys.inflight)) throw unknownState(keys.inflight)
    return await action({
      start: async () => {
        checkStopping(signal)
        const claimed = await redis.eval('if redis.call("get", KEYS[1]) == ARGV[1] and redis.call("exists", KEYS[2]) == 0 then redis.call("set", KEYS[2], ARGV[1]); return 1 else return 0 end', 2, keys.lease, keys.inflight, token)
        if (Number(claimed) !== 1) throw unknownState(keys.inflight)
        started = true
      },
      complete: () => { completed = true },
    })
  } catch (error) {
    // 中断连接不能取消上游同步任务；未知结果不得触发重试或释放持久保护。
    if (started && !completed) throw unknownState(keys.inflight, error)
    throw error
  } finally {
    clearInterval(heartbeat)
    await renewing
    await redis.eval('if ARGV[2] == "1" and redis.call("get", KEYS[2]) == ARGV[1] then redis.call("del", KEYS[2]) end; if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end', 2, keys.lease, keys.inflight, token, completed ? '1' : '0')
      .catch(error => logCaughtError('copilot release lease', error))
  }
}
