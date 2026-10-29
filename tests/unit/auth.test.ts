import { describe, expect, it } from 'vitest'
import { hashPassword, hashToken, verifyPassword } from '#server/services/auth'
import { checkLoginAttempt, clearLoginAttempts } from '#server/services/loginThrottle'
import { credentialsSchema } from '#server/dto/auth'

describe('密码哈希', () => {
  it('同一密码每次生成不同的哈希，且都能校验通过', async () => {
    const first = await hashPassword('correct horse battery')
    const second = await hashPassword('correct horse battery')
    expect(first).not.toBe(second)
    expect(first.startsWith('scrypt$')).toBe(true)
    expect(first).not.toContain('correct horse battery')
    expect(await verifyPassword('correct horse battery', first)).toBe(true)
    expect(await verifyPassword('correct horse battery', second)).toBe(true)
  })

  it('错误密码或损坏的哈希校验失败', async () => {
    const stored = await hashPassword('password-123')
    expect(await verifyPassword('password-124', stored)).toBe(false)
    expect(await verifyPassword('password-123', 'plain-text')).toBe(false)
    expect(await verifyPassword('password-123', 'scrypt$16384$8$1$AAAA$')).toBe(false)
  })

  it('会话 token 只以 SHA-256 摘要保存', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })
})

describe('注册参数校验', () => {
  it('拒绝过短的密码和非法用户名', () => {
    expect(credentialsSchema.safeParse({ username: 'alice', password: 'short' }).success).toBe(false)
    expect(credentialsSchema.safeParse({ username: 'a b', password: 'long-enough' }).success).toBe(false)
    expect(credentialsSchema.safeParse({ username: 'alice_01', password: 'long-enough' }).success).toBe(true)
  })
})

describe('登录尝试限流', () => {
  it('10 次以内放行，第 11 次返回 429，清除后恢复', () => {
    const key = `test:${Math.random()}`
    for (let index = 0; index < 10; index += 1) checkLoginAttempt(key, 1000)
    expect(() => checkLoginAttempt(key, 1000)).toThrowError(expect.objectContaining({ statusCode: 429 }))
    clearLoginAttempts(key)
    expect(() => checkLoginAttempt(key, 1000)).not.toThrow()
  })

  it('窗口过期后重新计数', () => {
    const key = `test:${Math.random()}`
    for (let index = 0; index < 11; index += 1) {
      try { checkLoginAttempt(key, 0) } catch {}
    }
    expect(() => checkLoginAttempt(key, 11 * 60 * 1000)).not.toThrow()
  })
})
