import { resolve } from 'node:path'

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** FTP 备份配置：FTP_HOST 为空时视为未启用；FTP_ENABLED=false 可显式关闭。 */
export function ftpConfig() {
  const host = (process.env.FTP_HOST || '').trim()
  const port = Math.trunc(numberFromEnv(process.env.FTP_PORT, 21))
  const dir = `/${(process.env.FTP_DIR || 'banana').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}`
  const errors: string[] = []
  if (host && (port < 1 || port > 65535)) errors.push('FTP_PORT 必须在 1-65535 之间')
  if (host && !process.env.FTP_USER) errors.push('缺少 FTP_USER')
  if (dir.split('/').includes('..')) errors.push('FTP_DIR 不能包含 ..')
  return {
    enabled: Boolean(host) && process.env.FTP_ENABLED !== 'false',
    host,
    port,
    user: process.env.FTP_USER || '',
    password: process.env.FTP_PASSWORD || '',
    dir,
    secure: process.env.FTP_SECURE === 'true',
    poolSize: Math.max(1, Math.min(8, Math.trunc(numberFromEnv(process.env.FTP_POOL_SIZE, 3)))),
    timeoutMs: Math.max(1000, numberFromEnv(process.env.FTP_TIMEOUT_MS, 15_000)),
    cacheMaxBytes: Math.max(0, numberFromEnv(process.env.FTP_CACHE_MAX_MB, 512)) * 1024 * 1024,
    errors,
  }
}

export function getServerConfig() {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    isProduction,
    database: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: numberFromEnv(process.env.DB_PORT, 3306),
      username: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'banana_image',
      synchronize: !isProduction && process.env.DB_SYNCHRONIZE !== 'false',
      logging: process.env.DB_LOGGING === 'true',
    },
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: numberFromEnv(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    vertex: {
      project: process.env.GOOGLE_CLOUD_PROJECT || '',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
      defaultModel: process.env.DEFAULT_IMAGE_MODEL || 'gemini-nano-banana-2.1',
      // 根据参考图推荐提示词使用的多模态文本模型
      promptModel: process.env.PROMPT_RECOMMEND_MODEL || 'gemini-3.1-flash-lite',
      promptRatePerMinute: Math.max(0, numberFromEnv(process.env.PROMPT_RECOMMEND_PER_MINUTE, 6)),
      models: (process.env.IMAGE_MODELS || 'gemini-nano-banana-2.1,gemini-3-pro-image,gemini-3.1-flash-image,gemini-3.1-flash-lite-image,gemini-2.5-flash-image').split(',').map(item => item.trim()).filter(Boolean),
    },
    ftp: ftpConfig(),
    storageDir: resolve(process.cwd(), process.env.STORAGE_DIR || './storage'),
    workerConcurrency: Math.max(1, Math.min(8, numberFromEnv(process.env.WORKER_CONCURRENCY, 2))),
  }
}

export type ServerConfig = ReturnType<typeof getServerConfig>
