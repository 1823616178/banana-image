import { z } from 'zod'

export const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点和横线')
export const passwordSchema = z.string().min(8, '密码至少 8 位').max(128)

export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema }).strict()
export const loginSchema = z.object({ username: z.string().trim().min(1).max(32), password: z.string().min(1).max(128) }).strict()
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict()

export const adminUserUpdateSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  disabled: z.boolean().optional(),
  password: passwordSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, '至少修改一项')
