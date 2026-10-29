import type { ApiSuccess, AuthUserDto } from '#shared/types/api'

export function useAuth() {
  const user = useState<AuthUserDto | null>('auth-user', () => null)
  const loaded = useState('auth-loaded', () => false)

  async function refresh() {
    const request = useRequestFetch()
    try {
      const response = await request<ApiSuccess<AuthUserDto | null>>('/api/auth/me')
      user.value = response.data
    } catch {
      user.value = null
    }
    loaded.value = true
    return user.value
  }

  async function login(username: string, password: string) {
    const response = await $fetch<ApiSuccess<AuthUserDto>>('/api/auth/login', { method: 'POST', body: { username, password } })
    user.value = response.data
    loaded.value = true
    return response.data
  }

  async function register(username: string, password: string) {
    const response = await $fetch<ApiSuccess<AuthUserDto>>('/api/auth/register', { method: 'POST', body: { username, password } })
    user.value = response.data
    loaded.value = true
    return response.data
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    user.value = null
    if (import.meta.client) localStorage.removeItem('banana-active-generation')
    await navigateTo('/login')
  }

  return { user, loaded, refresh, login, register, logout }
}
