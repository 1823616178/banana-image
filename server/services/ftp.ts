import { PassThrough, Readable } from 'node:stream'
import { posix } from 'node:path'
import { Client } from 'basic-ftp'
import { AppError, errorMessage } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'

/**
 * FTP 主存储客户端：basic-ftp 单个 Client 同一时间只能执行一条命令，
 * 这里维护一个小连接池（FTP_POOL_SIZE，默认 3），任务排队取用连接；连接出错即丢弃重建。
 * 所有错误信息都不包含密码。
 */
interface PooledClient { client: Client, busy: boolean }

const pool: PooledClient[] = []
const waiters: Array<() => void> = []

function ftpSettings() {
  const config = getServerConfig().ftp
  if (!config.enabled) throw new AppError('FTP_DISABLED', '未配置 FTP_HOST', 503)
  if (config.errors.length) throw new AppError('FTP_CONFIG_INVALID', `FTP 配置有误：${config.errors.join('；')}`, 503)
  return config
}

async function acquire(): Promise<PooledClient> {
  for (;;) {
    const config = ftpSettings()
    for (let index = pool.length - 1; index >= 0; index--) {
      if (!pool[index]!.busy && pool[index]!.client.closed) pool.splice(index, 1)
    }
    const idle = pool.find(item => !item.busy)
    if (idle) {
      idle.busy = true
      return idle
    }
    if (pool.length < config.poolSize) {
      const item: PooledClient = { client: new Client(config.timeoutMs), busy: true }
      pool.push(item)
      try {
        await item.client.access({ host: config.host, port: config.port, user: config.user, password: config.password, secure: config.secure })
        return item
      } catch (error) {
        release(item, true)
        throw error
      }
    }
    await new Promise<void>(resolveWaiter => waiters.push(resolveWaiter))
  }
}

function release(item: PooledClient, broken: boolean) {
  if (broken) {
    item.client.close()
    const index = pool.indexOf(item)
    if (index >= 0) pool.splice(index, 1)
  } else {
    item.busy = false
  }
  waiters.shift()?.()
}

function ftpError(action: string, error: unknown) {
  const code = (error as { code?: unknown })?.code
  const message = errorMessage(error)
  if (code === 550 || /\b550\b/.test(message)) return new AppError('FTP_FILE_NOT_FOUND', 'FTP 上的文件不存在', 404)
  if (code === 530 || /\b530\b/.test(message)) return new AppError('FTP_AUTH_FAILED', 'FTP 登录失败，请检查 FTP_USER / FTP_PASSWORD', 503)
  if (/ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT|Timeout/i.test(message)) return new AppError('FTP_UNREACHABLE', `无法连接 FTP 服务器（${action}）`, 503, undefined, { cause: error })
  return new AppError('FTP_ERROR', `FTP ${action}失败：${message.slice(0, 200)}`, 502, undefined, { cause: error })
}

/** 在连接池上执行操作，网络类错误按指数退避重试（默认 3 次）。550 等确定性错误不重试。 */
export async function withFtpClient<T>(action: string, task: (client: Client) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let item: PooledClient | undefined
    try {
      item = await acquire()
      const result = await task(item.client)
      release(item, false)
      return result
    } catch (error) {
      const mapped = error instanceof AppError ? error : ftpError(action, error)
      if (item) release(item, mapped.code !== 'FTP_FILE_NOT_FOUND')
      lastError = mapped
      if (['FTP_FILE_NOT_FOUND', 'FTP_AUTH_FAILED', 'FTP_DISABLED', 'FTP_CONFIG_INVALID'].includes(mapped.code) || attempt === attempts) break
      await new Promise(resolveDelay => setTimeout(resolveDelay, 300 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

/** 存储 key（如 images/2026/10/x.png）对应的 FTP 绝对路径 */
export function remotePath(key: string) {
  return posix.join(ftpSettings().dir, key)
}

export async function ftpUpload(key: string, data: Buffer) {
  const path = remotePath(key)
  await withFtpClient('上传', async (client) => {
    await client.ensureDir(posix.dirname(path))
    await client.uploadFrom(Readable.from([data]), posix.basename(path))
  })
}

export async function ftpDownload(key: string): Promise<Buffer> {
  const path = remotePath(key)
  return withFtpClient('下载', async (client) => {
    const chunks: Buffer[] = []
    const sink = new PassThrough()
    sink.on('data', (chunk: Buffer) => chunks.push(chunk))
    await client.downloadTo(sink, path)
    return Buffer.concat(chunks)
  })
}

export async function ftpRemove(key: string) {
  const path = remotePath(key)
  await withFtpClient('删除', client => client.remove(path).then(() => undefined)).catch((error) => {
    if (error instanceof AppError && error.code === 'FTP_FILE_NOT_FOUND') return
    throw error
  })
}

export async function checkFtpConnection() {
  const dir = ftpSettings().dir
  await withFtpClient('连接检测', async (client) => {
    await client.ensureDir(dir)
    await client.list()
  }, 1)
}

/** 测试与脚本退出时关闭所有连接 */
export function closeFtpPool() {
  for (const item of pool.splice(0)) item.client.close()
}
