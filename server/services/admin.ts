import type { AdminUserDto, UserRole } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { User } from '#server/db/entities/User'
import { UserSession } from '#server/db/entities/UserSession'
import { hashPassword, toAuthUser } from '#server/services/auth'
import { AppError } from '#server/utils/errors'

function toAdminUser(user: User): AdminUserDto {
  return { ...toAuthUser(user), disabled: user.disabled, lastLoginAt: user.lastLoginAt?.toISOString() ?? null }
}

export async function listUsers() {
  const source = await initializeDatabase()
  const users = await source.getRepository(User).find({ order: { id: 'ASC' } })
  return users.map(toAdminUser)
}

export interface UserUpdate {
  role?: UserRole
  disabled?: boolean
  password?: string
}

export async function updateUser(actorId: string, targetId: string, input: UserUpdate) {
  const source = await initializeDatabase()
  return source.transaction(async (manager) => {
    const repository = manager.getRepository(User)
    const user = await repository.findOneBy({ id: targetId })
    if (!user) throw new AppError('USER_NOT_FOUND', '用户不存在', 404)
    if (targetId === actorId && (input.role === 'user' || input.disabled === true)) {
      throw new AppError('CANNOT_DEMOTE_SELF', '不能取消自己的管理员身份或停用自己', 400)
    }
    const losesAdmin = user.role === 'admin' && !user.disabled && (input.role === 'user' || input.disabled === true)
    if (losesAdmin) {
      const activeAdmins = await repository.countBy({ role: 'admin', disabled: false })
      if (activeAdmins <= 1) throw new AppError('LAST_ADMIN', '至少需要保留一个可用的管理员', 400)
    }
    if (input.role !== undefined) user.role = input.role
    if (input.disabled !== undefined) user.disabled = input.disabled
    if (input.password !== undefined) user.passwordHash = await hashPassword(input.password)
    await repository.save(user)
    // 停用账号或被管理员重置密码时，立即注销该用户的全部会话。
    if (input.disabled === true || input.password !== undefined) await manager.getRepository(UserSession).delete({ userId: user.id })
    return toAdminUser(user)
  })
}
