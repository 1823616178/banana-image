import type { ApiFailure, ApiSuccess } from '../types/api'

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const body = await response.json() as ApiEnvelope<T>
  if (!response.ok || !('data' in body)) {
    throw new Error('message' in body ? body.message : `请求失败（${response.status}）`)
  }
  return body.data
}
