import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { IsNull, LessThan } from 'typeorm'
import type { AuthUserDto } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { User } from '#server/db/entities/User'
import { UserSession } from '#server/db/entities/UserSession'
import { getSettingsMap, settingValue } from '#server/services/settings'
import { AppError } from '#server/utils/errors'

interface ScryptParams { N: number, r: number, p: number, maxmem: number }
const SCRYPT: ScryptParams = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 64

function scryptAsync(password: string, salt: Buffer, keyLength: number, params: ScryptParams) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, params, (error, key) => error ? reject(error) : resolve(key))
  })
}

export const SESSION_COOKIE = 'bi_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltText, keyText] = parts
  const expected = Buffer.from(keyText!, 'base64')
  if (!expected.length) return false
  const key = await scryptAsync(password, Buffer.from(saltText!, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function toAuthUser(user: User): AuthUserDto {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt.toISOString() }
}

/** 环境变量 ALLOW_REGISTRATION=true 强制开放；否则由管理员在设置页切换（settings.allowRegistration）。 */
export async function registrationSetting() {
  if (process.env.ALLOW_REGISTRATION === 'true') return true
  return settingValue<boolean>(await getSettingsMap(), 'allowRegistration', false) === true
}

export async function registrationOpen() {
  if (await registrationSetting()) return true
  const source = await initializeDatabase()
  return await source.getRepository(User).count() === 0
}

export async function registerUser(username: string, password: string) {
  const source = await initializeDatabase()
  const passwordHash = await hashPassword(password)
  const allowed = await registrationSetting()
  return source.transaction(async (manager) => {
    const repository = manager.getRepository(User)
    const isFirst = await repository.count() === 0
    if (!isFirst && !allowed) {
      throw new AppError('REGISTRATION_CLOSED', '注册已关闭，请联系管理员', 403)
    }
    if (await repository.findOneBy({ username })) throw new AppError('USERNAME_TAKEN', '用户名已被占用', 409)
    const user = await repository.save(repository.create({ username, passwordHash, role: isFirst ? 'admin' : 'user', disabled: false, lastLoginAt: null }))
    // 首个账号接管登录功能上线前留下的无主任务与图片，避免历史作品丢失。
    if (isFirst) {
      await manager.getRepository(Generation).update({ userId: IsNull() }, { userId: user.id })
      await manager.getRepository(Image).createQueryBuilder().update().set({ userId: user.id }).where('userId IS NULL').execute()
    }
    return user
  })
}

export async function authenticate(username: string, password: string) {
  const source = await initializeDatabase()
  const user = await source.getRepository(User).findOneBy({ username })
  // 用户不存在时也做一次哈希运算，减少通过响应时间探测用户名的可能。
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false)
  if (!user || !valid) throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401)
  if (user.disabled) throw new AppError('ACCOUNT_DISABLED', '该账号已被停用，请联系管理员', 403)
  await source.getRepository(User).update({ id: user.id }, { lastLoginAt: new Date() })
  return user
}

export async function createSession(userId: string) {
  const source = await initializeDatabase()
  const token = randomBytes(32).toString('base64url')
  const repository = source.getRepository(UserSession)
  await repository.save(repository.create({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }))
  await repository.delete({ userId, expiresAt: LessThan(new Date()) })
  return token
}

export async function findSessionUser(token: string | undefined) {
  if (!token || token.length > 128) return null
  const source = await initializeDatabase()
  const session = await source.getRepository(UserSession).findOneBy({ tokenHash: hashToken(token) })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    await source.getRepository(UserSession).delete({ id: session.id })
    return null
  }
  const user = await source.getRepository(User).findOneBy({ id: session.userId })
  return user && !user.disabled ? user : null
}

export async function destroySession(token: string | undefined) {
  if (!token) return
  const source = await initializeDatabase()
  await source.getRepository(UserSession).delete({ tokenHash: hashToken(token) })
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepToken?: string) {
  const source = await initializeDatabase()
  const repository = source.getRepository(User)
  const user = await repository.findOneBy({ id: userId })
  if (!user || !await verifyPassword(currentPassword, user.passwordHash)) throw new AppError('INVALID_CREDENTIALS', '当前密码不正确', 400)
  user.passwordHash = await hashPassword(newPassword)
  await repository.save(user)
  // 改密后注销该用户的其他会话，仅保留当前会话。
  const sessions = source.getRepository(UserSession)
  const keepHash = keepToken ? hashToken(keepToken) : ''
  const remove = (await sessions.findBy({ userId })).filter(item => item.tokenHash !== keepHash).map(item => item.id)
  if (remove.length) await sessions.delete(remove)
}
