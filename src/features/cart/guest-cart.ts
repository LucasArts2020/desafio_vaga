import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import {
  guestCartHeader,
  type AddCartItem, type Cart, type CartSelection, type GuestCartSession, type UpdateCartItem, type CartVersion,
} from '@/contracts/cart'
import { api, apiProblem, retryApiRead } from '@/lib/api'
import { useSessionToken } from '@/features/auth/session-query'
import { sessionHeaders, sessionToken, sessionVersion } from '@/lib/session-token'

const storageKey = 'acervo.guest-cart'
const listeners = new Set<() => void>()
let generation = 0

export function guestCartToken() {
  return sessionStorage.getItem(storageKey)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notifyTokenChanged() {
  listeners.forEach((listener) => listener())
}

export function clearGuestCart() {
  generation += 1
  sessionStorage.removeItem(storageKey)
  notifyTokenChanged()
}

export function cartQueryKey(token: string | null, isPrivate: boolean) {
  return isPrivate ? ['private', token, 'cart'] as const : ['cart', 'guest', token] as const
}

export function cartHeaders(token: string, isPrivate: boolean) {
  return isPrivate ? sessionHeaders(token) : { [guestCartHeader]: token }
}

async function fetchCart(token: string, isPrivate: boolean, signal?: AbortSignal) {
  try {
    const { data } = await api.get<Cart>('/cart', { headers: cartHeaders(token, isPrivate), signal })
    return data
  } catch (error) {
    if (isPrivate || apiProblem(error)?.code !== 'CART_NOT_FOUND') throw error
    if (guestCartToken() === token) clearGuestCart()
    return null
  }
}

export function useCart() {
  const guest = useSyncExternalStore(subscribe, guestCartToken)
  const session = useSessionToken()
  const token = session ?? guest
  const isPrivate = session !== null
  const query = useQuery({
    queryKey: cartQueryKey(token, isPrivate),
    queryFn: ({ signal }) => token ? fetchCart(token, isPrivate, signal) : null,
    enabled: token !== null,
    retry: retryApiRead,
  })
  return { ...query, token, isPrivate }
}

type CartAction =
  | ({ type: 'add'; quantity: number } & CartSelection)
  | { type: 'update'; lineId: string; quantity: number; expectedVersion: number }
  | { type: 'remove'; lineId: string; expectedVersion: number }
  | { type: 'apply-coupon'; code: string; expectedVersion: number }
  | { type: 'remove-coupon'; expectedVersion: number }

export function useCartMutation() {
  const client = useQueryClient()
  const session = useSessionToken()

  const mutation = useMutation({
    scope: { id: 'cart' },
    mutationKey: session ? ['private', session, 'cart'] : ['cart', 'guest'],
    async mutationFn({ action, session, version }: { action: CartAction; session: string | null; version: number }) {
      if (sessionVersion() !== version) throw new Error('A sessão mudou.')
      const isPrivate = session !== null
      let token = session ?? guestCartToken()

      if (action.type === 'add') {
        let cart = token ? await fetchCart(token, isPrivate) : null
        if (!token || !cart) {
          const currentGeneration = generation
          const { data } = await api.post<GuestCartSession>('/carts/guest')
          if (generation !== currentGeneration || sessionVersion() !== version) throw new Error('O carrinho foi reiniciado.')
          token = data.token
          cart = data.cart
          sessionStorage.setItem(storageKey, token)
          notifyTokenChanged()
        }
        if ((sessionToken() ?? guestCartToken()) !== token) throw new Error('O carrinho foi reiniciado.')

        const payload: AddCartItem = {
          ...('openSea' in action ? { openSea: action.openSea } : { nftId: action.nftId, editionId: action.editionId }),
          quantity: action.quantity,
          expectedVersion: cart.version,
        }
        const { data } = await api.post<Cart>('/cart/items', payload, {
          headers: cartHeaders(token, isPrivate),
          ...('openSea' in action && { timeout: 16_000 }),
        })
        return { token, isPrivate, cart: data }
      }

      if (!token) throw new Error('Carrinho de visitante não encontrado.')
      const headers = cartHeaders(token, isPrivate)
      const expected: CartVersion = { expectedVersion: action.expectedVersion }
      if (action.type === 'apply-coupon' || action.type === 'remove-coupon') {
        const { data } = action.type === 'apply-coupon'
          ? await api.put<Cart>('/cart/coupon', { ...expected, code: action.code }, { headers })
          : await api.delete<Cart>('/cart/coupon', { headers, data: expected })
        return { token, isPrivate, cart: data }
      }

      const url = `/cart/items/${encodeURIComponent(action.lineId)}`
      const payload: UpdateCartItem | undefined = action.type === 'update'
        ? { ...expected, quantity: action.quantity }
        : undefined
      const { data } = payload
        ? await api.patch<Cart>(url, payload, { headers })
        : await api.delete<Cart>(url, { headers, data: expected })
      return { token, isPrivate, cart: data }
    },
    async onSuccess({ token, isPrivate, cart }) {
      const queryKey = cartQueryKey(token, isPrivate)
      await client.cancelQueries({ queryKey, exact: true })
      if ((sessionToken() ?? guestCartToken()) === token) {
        client.setQueryData<Cart>(queryKey, (current) => current && current.version > cart.version ? current : cart)
      }
    },
    onError(_error, variables) {
      if (sessionVersion() !== variables.version) return
      return client.invalidateQueries({ queryKey: cartQueryKey(variables.session ?? guestCartToken(), variables.session !== null), exact: true })
    },
  })

  return {
    ...mutation,
    mutate: (action: CartAction) => mutation.mutate({ action, session, version: sessionVersion() }),
  }
}
