import { resolve } from 'node:path'

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
      models: (process.env.IMAGE_MODELS || 'gemini-nano-banana-2.1,gemini-3-pro-image,gemini-3.1-flash-image,gemini-3.1-flash-lite-image,gemini-2.5-flash-image').split(',').map(item => item.trim()).filter(Boolean),
    },
    storageDir: resolve(process.cwd(), process.env.STORAGE_DIR || './storage'),
    workerConcurrency: Math.max(1, Math.min(8, numberFromEnv(process.env.WORKER_CONCURRENCY, 2))),
  }
}

export type ServerConfig = ReturnType<typeof getServerConfig>
