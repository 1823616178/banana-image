import { readdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// 检查所有本机 checkout，不按 cwd 过滤，以覆盖旧目录和 tsx watch 遗留进程。
export async function findWorkerProcesses(procRoot = '/proc') {
  const workers = []
  for (const pid of await readdir(procRoot)) {
    if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue
    let command
    try {
      command = (await readFile(`${procRoot}/${pid}/cmdline`, 'utf8')).replaceAll('\0', ' ')
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ESRCH') continue
      throw new Error(`无法检查 PID ${pid}；请用可读取进程信息的账户执行检查`, { cause: error })
    }
    if (/(?:^|[\s/])server\/worker\.ts(?:\s|$)/.test(command)
      || /(?:^|\s)(?:npm|yarn|pnpm)(?:\s+run)?\s+(?:dev:)?worker(?:\s|$)/.test(command)) {
      workers.push(Number(pid))
    }
  }
  return workers
}

export function assertFreshPm2Processes(processes) {
  const existing = processes.filter(item => ['banana-web', 'banana-worker'].includes(item.name))
  if (existing.length) {
    throw new Error('请先停止并删除旧 PM2 banana-web / banana-worker 条目；保留条目会继承旧凭据和停机配置。参见 README 的 PM2 升级步骤。')
  }
}

async function main() {
  if (process.platform !== 'linux') throw new Error('此启动检查面向 Linux /proc；其他平台请按 README 手动完成独占升级。')
  const workers = await findWorkerProcesses()
  if (workers.length) throw new Error(`仍有 worker 或 watch 进程存活（PID: ${workers.join(', ')}），拒绝启动新版本。请先停止其进程管理器，避免自动拉起。`)
  // jlist 包含环境变量，只解析，不将原始结果写入日志。
  const processes = JSON.parse(execFileSync('pm2', ['jlist', '--silent'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
  assertFreshPm2Processes(processes)
  console.info('本机旧 worker 和 PM2 条目检查通过。共享数据库的其他主机也必须已停止旧 worker。')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
