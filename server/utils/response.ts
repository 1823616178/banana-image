import type { H3Event } from 'h3'
import type { ApiFailure, ApiSuccess } from '#shared/types/api'
import { AppError, errorMessage, logCaughtError } from '#server/utils/errors'

export function ok<T>(data: T, message = 'ok'): ApiSuccess<T> {
  return { code: 0, data, message }
}

export async function respond<T>(event: H3Event, action: () => Promise<T> | T): Promise<ApiSuccess<T> | ApiFailure> {
  try {
    return ok(await action())
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', '服务器暂时无法完成请求', 500)
    logCaughtError('api', error)
    setResponseStatus(event, appError.statusCode)
    return {
      code: appError.code,
      message: appError.message || errorMessage(error),
      ...(appError.details === undefined ? {} : { details: appError.details }),
    }
  }
}
