import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { NftNetwork } from '@/contracts/catalog'
import type { Quote, QuoteInput } from '@/contracts/quote'
import { api, apiProblem, retryApiRead } from '@/lib/api'
import { cartHeaders, cartQueryKey } from './guest-cart'

export function useQuote(token: string | null, isPrivate: boolean, version: number | undefined, network: NftNetwork) {
  const client = useQueryClient()
  const cartKey = cartQueryKey(token, isPrivate)
  const quote = useQuery({
    queryKey: [...cartKey, 'quote', version, network],
    enabled: token !== null && version !== undefined,
    async queryFn({ signal }) {
      if (!token || version === undefined) throw new Error('Carrinho indisponível para cotação.')
      const input: QuoteInput = { expectedVersion: version, network }
      try {
        const { data } = await api.post<Quote>('/quotes', input, { headers: cartHeaders(token, isPrivate), signal })
        return data
      } catch (error) {
        if (apiProblem(error)?.code === 'CART_CHANGED') {
          void client.invalidateQueries({ queryKey: cartKey, exact: true })
        }
        throw error
      }
    },
    retry: retryApiRead,
  })

  const expiresAt = quote.data?.expiresAt
  const { refetch } = quote
  useEffect(() => {
    if (!expiresAt) return
    const delay = Math.max(0, Date.parse(expiresAt) - Date.now()) + 1
    const timer = window.setTimeout(() => void refetch(), delay)
    return () => window.clearTimeout(timer)
  }, [expiresAt, refetch])

  return quote
}
