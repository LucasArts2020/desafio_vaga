import { queryOptions, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { Session } from '@/contracts/auth'
import { api, retryApiRead } from '@/lib/api'
import { sessionHeaders, sessionToken, subscribeSession } from '@/lib/session-token'

export function useSessionToken() {
  return useSyncExternalStore(subscribeSession, sessionToken)
}

export function sessionOptions(token: string | null) {
  return queryOptions({
    queryKey: ['private', token, 'session'],
    queryFn: async ({ signal }) => {
      if (!token) return null
      const { data } = await api.get<Session>('/session', { headers: sessionHeaders(token), signal })
      return data
    },
    enabled: token !== null,
    retry: retryApiRead,
  })
}

export function useSession(watch = false) {
  const token = useSessionToken()
  return useQuery({
    ...sessionOptions(token),
    refetchInterval: watch && token ? 30_000 : false,
  })
}
