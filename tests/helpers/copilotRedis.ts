import { vi } from 'vitest'

export const leases = new Map<string, { token: string, expiresAt: number }>()
export const inflight = new Map<string, string>()
export const copilotRedis = { set: vi.fn(), get: vi.fn(), eval: vi.fn(), scan: vi.fn(), lpush: vi.fn() }

function lease(key: string) {
  const value = leases.get(key)
  if (value && value.expiresAt <= Date.now()) { leases.delete(key); return undefined }
  return value
}

export function resetCopilotRedis() {
  leases.clear()
  inflight.clear()
  for (const command of Object.values(copilotRedis)) command.mockReset()
  copilotRedis.scan.mockResolvedValue(['0', []])
  copilotRedis.lpush.mockResolvedValue(1)
  copilotRedis.set.mockImplementation(async (key: string, token: string, _px: string, ttl: number) => {
    if (lease(key)) return null
    leases.set(key, { token, expiresAt: Date.now() + ttl })
    return 'OK'
  })
  copilotRedis.get.mockImplementation(async (key: string) => lease(key)?.token ?? inflight.get(key) ?? null)
  copilotRedis.eval.mockImplementation(async (script: string, count: number, ...args: Array<string | number>) => {
    const keys = args.slice(0, count).map(String)
    const argv = args.slice(count).map(String)
    if (script.includes('"pexpire"')) {
      if (lease(keys[0]!)?.token !== argv[0]) return 0
      leases.get(keys[0]!)!.expiresAt = Date.now() + Number(argv[1])
      return 1
    }
    if (script.startsWith('return redis.call("exists"')) return inflight.has(keys[0]!) && !lease(keys[1]!) ? 1 : 0
    if (script.includes('redis.call("set", KEYS[2]')) {
      if (lease(keys[0]!)?.token !== argv[0] || inflight.has(keys[1]!)) return 0
      inflight.set(keys[1]!, argv[0]!)
      return 1
    }
    if (script.includes('ARGV[2] == "1"')) {
      if (argv[1] === '1' && inflight.get(keys[1]!) === argv[0]) inflight.delete(keys[1]!)
      if (lease(keys[0]!)?.token !== argv[0]) return 0
      leases.delete(keys[0]!)
      return 1
    }
    throw new Error('Unsupported Redis script in test')
  })
}
