import type { ApiFailure, ApiSuccess } from '#shared/types/api'

type FetchOptions = NonNullable<Parameters<typeof $fetch>[1]>

/** 统一的接口调用：解包 data；遇到 401 时清空登录态并跳转登录页。 */
export function useApi() {
  const { user } = useAuth()
  const request = useRequestFetch()
  const route = useRoute()

  async function api<T>(url: string, options?: FetchOptions): Promise<T> {
    try {
      const response = await request<ApiSuccess<T>>(url, options as never)
      return response.data
    } catch (error) {
      const failure = error as { statusCode?: number, status?: number }
      if ((failure.statusCode ?? failure.status) === 401) {
        user.value = null
        await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
      }
      throw error
    }
  }

  return api
}

export function apiErrorMessage(error: unknown) {
  const failure = error as { data?: ApiFailure, message?: string }
  return failure.data?.message ?? failure.message ?? '操作失败，请稍后重试'
}
