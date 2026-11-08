import axios from 'axios'
import type { ApiError } from '@/contracts/api-error'
import { sessionToken, setSessionToken } from './session-token'

export const apiBasePath = '/api/v1'

export const api = axios.create({
  baseURL: apiBasePath,
  timeout: 8_000,
  headers: { Accept: 'application/json' },
})

export function apiProblem(error: unknown) {
  return axios.isAxiosError<ApiError>(error) ? error.response?.data : undefined
}

api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError<ApiError>(error) && error.response?.status === 401) {
    const code = error.response.data?.code
    const token = sessionToken()
    if ((code === 'SESSION_EXPIRED' || code === 'SESSION_INVALID') && token
      && error.config?.headers.get('Authorization') === `Bearer ${token}`) {
      setSessionToken(null, true)
    }
  }
  return Promise.reject(error)
})

export function retryApiRead(failureCount: number, error: unknown) {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return false
  return failureCount < 2 && (!error.response || error.response.status >= 500)
}
