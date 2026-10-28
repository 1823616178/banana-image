import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { AppError } from '#server/utils/errors'

export async function readSchema<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const result = await readValidatedBody(event, body => schema.safeParse(body))
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', '请求参数不符合要求', 400, result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })))
  }
  return result.data
}

export function idParam(value: unknown) {
  const id = String(value ?? '')
  if (!/^\d+$/.test(id) || id === '0' || id.length > 20) {
    throw new AppError('INVALID_ID', '无效的资源 ID', 400)
  }
  return id
}
