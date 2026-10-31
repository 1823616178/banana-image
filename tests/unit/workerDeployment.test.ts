import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertFreshPm2Processes, findWorkerProcesses } from '../../scripts/check-workers-stopped.mjs'
import { COPILOT_TIMEOUT_MS, COPILOT_DOWNLOAD_TIMEOUT_MS } from '#server/services/copilotQueue'

const require = createRequire(import.meta.url)
const ecosystem = require('../../ecosystem.config.cjs')
const temporaryDirectories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'banana-deployment-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('独占部署检查', () => {
  it('检测不同 checkout 和 tsx watch 遗留进程，忽略无关服务与已退出进程', async () => {
    const proc = await temporaryDirectory()
    for (const [pid, command] of [
      ['101', 'node\0/old/release/node_modules/tsx/dist/cli.mjs\0server/worker.ts\0'],
      ['102', 'node\0tsx\0watch\0/another/release/server/worker.ts\0'],
      ['103', 'npm run dev:worker\0'],
      ['104', 'node\0/other/app/server/index.mjs\0'],
      ['105', ''],
    ]) {
      await mkdir(join(proc, pid!))
      await writeFile(join(proc, pid!, 'cmdline'), command!)
    }
    await mkdir(join(proc, '106'))
    expect((await findWorkerProcesses(proc)).sort()).toEqual([101, 102, 103])
  })

  it('拒绝复用已停止的旧 PM2 条目，避免继承旧凭据', () => {
    expect(() => assertFreshPm2Processes([{ name: 'banana-worker', pm2_env: { status: 'stopped' } }])).toThrow('旧凭据')
    expect(() => assertFreshPm2Processes([{ name: 'unrelated-app' }])).not.toThrow()
  })
})

describe('PM2 凭据与退出配置', () => {
  it.each(ecosystem.apps)('$name 保留显式凭据、允许 .env 凭据以及默认凭据发现', async (app) => {
    const directory = await temporaryDirectory()
    const envFile = join(directory, '.env')
    await writeFile(envFile, 'GOOGLE_APPLICATION_CREDENTIALS=/tmp/from-env-file.json\n')
    const baseEnv = { ...process.env, ...app.env }
    delete baseEnv.GOOGLE_APPLICATION_CREDENTIALS
    const command = 'process.stdout.write(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "ADC")'
    const run = (env: NodeJS.ProcessEnv, file?: string) => execFileSync(process.execPath, [...(file ? [`--env-file=${file}`] : []), '-e', command], { env, encoding: 'utf8' })
    expect(app.env).not.toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS')
    expect(app.env).not.toHaveProperty('HOME')
    expect(run({ ...baseEnv, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/explicit.json' }, envFile)).toBe('/tmp/explicit.json')
    expect(run(baseEnv, envFile)).toBe('/tmp/from-env-file.json')
    expect(run(baseEnv)).toBe('ADC')
  })

  it('直接运行 worker，停机预算覆盖生成、下载、重试和存储余量', () => {
    const worker = ecosystem.apps.find((app: { name: string }) => app.name === 'banana-worker')
    expect(worker.script).toBe('server/worker.ts')
    expect(worker.node_args).toBe('--import tsx')
    expect(worker.kill_timeout).toBeGreaterThanOrEqual(4 * (120_000 + 30_000) + 7_000 + 120_000)
    expect(worker.kill_timeout).toBeGreaterThanOrEqual(COPILOT_TIMEOUT_MS + COPILOT_DOWNLOAD_TIMEOUT_MS + 120_000)
  })
})
