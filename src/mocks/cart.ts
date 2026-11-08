import { http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import type { CartMerge } from '@/contracts/auth'
import { guestCartHeader, type Cart, type GuestCartSession } from '@/contracts/cart'
import { openSeaCartPrice, openSeaPath, type OpenSeaNftDetail } from '@/contracts/opensea'
import { apiBasePath } from '@/lib/api'
import { formatEth, parseEth } from '@/lib/eth'
import { MockFailure, respondToMock } from './api-error'
import { readCoupon } from './coupons'
import type { CartOwner, MockState, StoredCart, StoredCartLine } from './fixtures'
import { readMockState, updateMockState } from './repository'
import { requireSession } from './session'

function accountCart(state: MockState, userId: string): StoredCart {
  return state.accountCarts[userId] ??= { version: 1, items: [] }
}

export function resolveCart(state: MockState, request: Request): { owner: CartOwner; cart: StoredCart } {
  if (request.headers.has('Authorization')) {
    const id = requireSession(state, request).account.id
    return { owner: { kind: 'account', id }, cart: accountCart(state, id) }
  }
  const token = request.headers.get(guestCartHeader)
  if (!token || !Object.hasOwn(state.guestCarts, token)) {
    throw new MockFailure(404, 'CART_NOT_FOUND', 'Carrinho de visitante não encontrado.')
  }
  return { owner: { kind: 'guest', id: token }, cart: state.guestCarts[token] }
}

export function getEdition(state: MockState, nftId: string, editionId: string) {
  const nft = state.nfts.find((item) => item.id === nftId)
  const edition = nft?.editions.find((item) => item.id === editionId)
  if (!nft || !edition) throw new MockFailure(404, 'EDITION_NOT_FOUND', 'Edição não encontrada.')
  return { nft, edition }
}

export function presentCart(state: MockState, cart: StoredCart): Cart {
  let subtotal = 0n
  const items = cart.items.map((line) => {
    const { external, ...stored } = line
    if (external) {
      const { priceUsdc, ...product } = external
      const lineTotal = parseEth(external.priceEth) * BigInt(line.quantity)
      subtotal += lineTotal
      const stablecoin = priceUsdc === undefined ? undefined : { price: priceUsdc, subtotal: formatEth(parseEth(priceUsdc) * BigInt(line.quantity)) }
      return { ...stored, ...product, subtotalEth: formatEth(lineTotal), ...(stablecoin && { stablecoin }) }
    }
    const { nft, edition } = getEdition(state, line.nftId, line.editionId)
    const lineTotal = parseEth(edition.priceEth) * BigInt(line.quantity)
    subtotal += lineTotal
    return {
      ...stored,
      title: nft.title,
      editionLabel: edition.label,
      cover: nft.media[0] ?? null,
      availableQuantity: edition.availableQuantity,
      priceEth: edition.priceEth,
      subtotalEth: formatEth(lineTotal),
    }
  })
  return { version: cart.version, items, subtotalEth: formatEth(subtotal), couponCode: cart.couponCode ?? null }
}

async function respondWithCart(read: () => Promise<Cart>) {
  return respondToMock(async () => HttpResponse.json<Cart>(await read()))
}

export function mergeGuestCart(state: MockState, token: string | null, userId: string): CartMerge {
  if (token && Object.hasOwn(state.guestClaims, token)) {
    const claim = state.guestClaims[token]
    if (claim.userId !== userId) {
      throw new MockFailure(403, 'GUEST_CART_CLAIMED', 'Esta seleção de visitante já foi incorporada a outra conta.')
    }
    return claim.merge
  }

  const merge: CartMerge = { moved: 0, omitted: 0 }
  if (!token || !Object.hasOwn(state.guestCarts, token)) return merge

  const guest = state.guestCarts[token]
  const target = accountCart(state, userId)
  for (const line of guest.items) {
    const nft = state.nfts.find((item) => item.id === line.nftId)
    const edition = nft?.editions.find((item) => item.id === line.editionId)
    const existing = target.items.find((item) => item.nftId === line.nftId && item.editionId === line.editionId)
    const available = existing?.external?.availableQuantity ?? line.external?.availableQuantity ?? edition?.availableQuantity ?? 0
    const remaining = Math.max(0, available - (existing?.quantity ?? 0))
    const moved = Math.min(line.quantity, remaining)
    if (moved > 0) {
      if (existing) existing.quantity += moved
      else target.items.push({ ...line, quantity: moved })
    }
    merge.moved += moved
    merge.omitted += line.quantity - moved
  }
  const coupon = guest.couponCode
  let couponChanged = false
  if (coupon && coupon !== target.couponCode) {
    if (target.couponCode) {
      merge.couponNotice = 'O cupom da conta foi mantido.'
    } else if (readCoupon(coupon, Date.now()).issue) {
      merge.couponNotice = 'O cupom de visitante deixou de ser válido.'
    } else {
      target.couponCode = coupon
      couponChanged = true
    }
  }
  if (merge.moved > 0 || couponChanged) target.version += 1
  delete state.guestCarts[token]
  state.guestClaims[token] = { userId, merge }
  return merge
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function readQuantity(payload: object) {
  if ('quantity' in payload && positiveInteger(payload.quantity)) return payload.quantity
  throw new MockFailure(422, 'INVALID_QUANTITY', 'Informe uma quantidade inteira e positiva.')
}

function ensureAvailable(available: number, quantity: number) {
  if (quantity > available) {
    throw new MockFailure(409, 'QUANTITY_UNAVAILABLE', 'A quantidade excede a disponibilidade desta edição.')
  }
}

async function resolveOpenSeaSelection(request: Request, input: unknown) {
  if (!input || typeof input !== 'object' || !('collection' in input) || typeof input.collection !== 'string'
    || !/^[a-z\d-]{1,100}$/.test(input.collection) || !('contract' in input) || typeof input.contract !== 'string'
    || !/^0x[\da-f]{40}$/i.test(input.contract) || !('identifier' in input) || typeof input.identifier !== 'string'
    || !/^\d{1,78}$/.test(input.identifier)) {
    throw new MockFailure(422, 'INVALID_EDITION', 'Selecione um NFT da OpenSea válido.')
  }
  const openSea = { collection: input.collection, contract: input.contract.toLowerCase(), identifier: input.identifier }
  const url = new URL(openSeaPath, request.url)
  url.search = new URLSearchParams(openSea).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(14_000) }).catch(() => null)
  if (response?.status === 404) throw new MockFailure(409, 'QUANTITY_UNAVAILABLE', 'O NFT deixou de estar disponível na OpenSea.')
  if (!response?.ok) throw new MockFailure(503, 'OPENSEA_UNAVAILABLE', 'Não foi possível verificar o anúncio da OpenSea. Tente novamente.')
  const detail = await response.json() as OpenSeaNftDetail
  const listing = openSeaCartPrice(detail)
  if (!listing) throw new MockFailure(409, 'QUANTITY_UNAVAILABLE', 'Este anúncio não está disponível em uma moeda aceita pelo carrinho.')
  const external: NonNullable<StoredCartLine['external']> = {
    openSea,
    title: detail.name,
    editionLabel: 'Anúncio',
    cover: detail.imageUrl ? { url: detail.imageUrl, alt: detail.name } : null,
    availableQuantity: listing.quantity,
    priceEth: listing.price.currency === 'ETH' ? listing.price.amount : '0',
    ...(listing.price.currency === 'USDC.e' && { priceUsdc: listing.price.amount }),
  }
  return { nftId: `opensea:${detail.chain}:${openSea.contract}:${openSea.identifier}`, editionId: 'listing', external }
}

function cartMutation(operation: 'add' | 'update' | 'remove' | 'apply-coupon' | 'remove-coupon'): HttpResponseResolver<PathParams, DefaultBodyType, Cart | ApiError> {
  return async ({ request, params }) => {
    const payload: unknown = await request.json().catch(() => null)
    return respondWithCart(async () => {
      const selection = operation === 'add' && payload && typeof payload === 'object' && 'openSea' in payload
        ? await resolveOpenSeaSelection(request, payload.openSea)
        : null
      return updateMockState((state) => {
        const { cart } = resolveCart(state, request)
        if (!payload || typeof payload !== 'object' || !('expectedVersion' in payload)
          || !positiveInteger(payload.expectedVersion)) {
          throw new MockFailure(422, 'INVALID_CART_VERSION', 'Versão do carrinho inválida.')
        }
        if (cart.version !== payload.expectedVersion) {
          throw new MockFailure(409, 'CART_CHANGED', 'O carrinho mudou. Revise os itens e tente novamente.')
        }
        if (operation === 'apply-coupon') {
          const code = 'code' in payload && typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : ''
          const { issue } = readCoupon(code, Date.now())
          if (issue) throw new MockFailure(422, issue.code, issue.message, { code: issue.message })
          cart.couponCode = code
        } else if (operation === 'remove-coupon') {
          delete cart.couponCode
        } else if (operation === 'add') {
          const nftId = selection?.nftId ?? ('nftId' in payload ? payload.nftId : undefined)
          const editionId = selection?.editionId ?? ('editionId' in payload ? payload.editionId : undefined)
          if (typeof nftId !== 'string' || typeof editionId !== 'string') {
            throw new MockFailure(422, 'INVALID_EDITION', 'Selecione a obra e a edição.')
          }
          const existing = cart.items.find((line) => line.nftId === nftId && line.editionId === editionId)
          const quantity = (existing?.quantity ?? 0) + readQuantity(payload)
          const available = selection?.external.availableQuantity ?? getEdition(state, nftId, editionId).edition.availableQuantity
          ensureAvailable(available, quantity)
          if (existing) {
            existing.quantity = quantity
            if (selection) existing.external = selection.external
          } else {
            const line = { id: crypto.randomUUID(), nftId, editionId, quantity }
            cart.items.push(selection ? { ...line, external: selection.external } : line)
          }
        } else {
          const index = cart.items.findIndex((line) => line.id === params.lineId)
          if (index === -1) throw new MockFailure(404, 'CART_ITEM_NOT_FOUND', 'Item não encontrado.')
          if (operation === 'remove') {
            cart.items.splice(index, 1)
          } else {
            const line = cart.items[index]
            const quantity = readQuantity(payload)
            const available = line.external?.availableQuantity ?? getEdition(state, line.nftId, line.editionId).edition.availableQuantity
            ensureAvailable(available, quantity)
            line.quantity = quantity
          }
        }
        cart.version += 1
        return presentCart(state, cart)
      })
    })
  }
}

export const cartHandlers = [
  http.post(`${apiBasePath}/carts/guest`, async () => {
    const session = await updateMockState((state) => {
      const token = crypto.randomUUID()
      const cart: StoredCart = { version: 1, items: [] }
      state.guestCarts[token] = cart
      return { token, cart: presentCart(state, cart) }
    })
    return HttpResponse.json<GuestCartSession>(session, { status: 201 })
  }),
  http.get<PathParams, never, Cart | ApiError>(`${apiBasePath}/cart`, ({ request }) => respondWithCart(async () => {
    const state = await readMockState()
    return presentCart(state, resolveCart(state, request).cart)
  })),
  http.post(`${apiBasePath}/cart/items`, cartMutation('add')),
  http.patch(`${apiBasePath}/cart/items/:lineId`, cartMutation('update')),
  http.delete(`${apiBasePath}/cart/items/:lineId`, cartMutation('remove')),
  http.put(`${apiBasePath}/cart/coupon`, cartMutation('apply-coupon')),
  http.delete(`${apiBasePath}/cart/coupon`, cartMutation('remove-coupon')),
]
