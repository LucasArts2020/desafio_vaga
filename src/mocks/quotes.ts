import { http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import { nftNetworks, type NftNetwork } from '@/contracts/catalog'
import type { Quote, QuoteInput, QuoteIssue, QuoteReview } from '@/contracts/quote'
import { apiBasePath } from '@/lib/api'
import { calculateEthTotals, formatEth, parseEth, type EthDecimal } from '@/lib/eth'
import { MockFailure, respondToMock } from './api-error'
import { getEdition, presentCart, resolveCart } from './cart'
import { readCoupon } from './coupons'
import type { CartOwner, MockState, StoredCart } from './fixtures'
import { updateMockState } from './repository'
import { requireSession } from './session'

const quoteLifetime = 5 * 60_000
const feeByNetwork: Record<NftNetwork, EthDecimal> = { ethereum: '0.002', polygon: '0.0005' }
const stablecoinScale = 10n ** 12n

async function readInput(request: Request): Promise<QuoteInput> {
  const body: unknown = await request.json().catch(() => null)
  const version = body && typeof body === 'object' && 'expectedVersion' in body ? body.expectedVersion : undefined
  const network = nftNetworks.find((value) => body && typeof body === 'object' && 'network' in body && body.network === value)
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1 || !network) {
    throw new MockFailure(422, 'INVALID_QUOTE_INPUT', 'Informe a versão do carrinho e uma rede disponível.')
  }
  return { expectedVersion: version, network }
}

function quoteSnapshot(state: MockState, cart: StoredCart, network: NftNetwork, now: number): Omit<Quote, 'quoteId' | 'expiresAt'> {
  const { items, couponCode } = presentCart(state, cart)
  const issues: QuoteIssue[] = []
  if (!items.length) issues.push({ code: 'EMPTY_CART', message: 'O carrinho está vazio.' })

  const lines = items.map((item) => {
    if (item.quantity > item.availableQuantity) {
      issues.push({ code: 'QUANTITY_UNAVAILABLE', lineId: item.id, message: `Quantidade indisponível para ${item.title} · ${item.editionLabel}.` })
    }
    const nftVersion = item.openSea ? cart.version : getEdition(state, item.nftId, item.editionId).nft.version
    return { ...item, nftVersion }
  })
  const coupon = couponCode ? readCoupon(couponCode, now) : undefined
  if (coupon?.issue) issues.push(coupon.issue)
  const discountBps = coupon?.discountBps ?? 0
  const totals = calculateEthTotals(lines, discountBps, lines.length ? feeByNetwork[network] : '0')
  const stablecoinLines = lines.flatMap(({ stablecoin }) => stablecoin ? [stablecoin.subtotal] : [])
  if (stablecoinLines.length) {
    if (network !== 'polygon') issues.push({ code: 'NETWORK_UNAVAILABLE', message: 'Selecione Polygon para revisar anúncios em USDC.e.' })
    const subtotal = stablecoinLines.reduce((sum, amount) => sum + parseEth(amount) / stablecoinScale, 0n)
    const discount = subtotal * BigInt(discountBps) / 10_000n
    const stablecoin = {
      subtotal: formatEth(subtotal * stablecoinScale),
      discount: formatEth(discount * stablecoinScale),
      total: formatEth((subtotal - discount) * stablecoinScale),
    }
    return { cartVersion: cart.version, network, couponCode, lines, issues, ...totals, stablecoin }
  }

  return { cartVersion: cart.version, network, couponCode, lines, issues, ...totals }
}

function sameOwner(a: CartOwner, b: CartOwner) {
  return a.kind === b.kind && a.id === b.id
}

export const quoteHandlers = [
  http.post<PathParams, DefaultBodyType, Quote | ApiError>(`${apiBasePath}/quotes`, ({ request }) =>
    respondToMock(async () => {
      const { expectedVersion, network } = await readInput(request)
      const quote = await updateMockState((state) => {
        const { owner, cart } = resolveCart(state, request)
        if (cart.version !== expectedVersion) {
          throw new MockFailure(409, 'CART_CHANGED', 'O carrinho mudou. Atualize a seleção para cotar novamente.')
        }
        const now = Date.now()
        const snapshot = quoteSnapshot(state, cart, network, now)
        const signature = JSON.stringify(snapshot)
        for (const [id, record] of Object.entries(state.quotes)) {
          const expiresAt = Date.parse(record.quote.expiresAt)
          if (expiresAt <= now - 6 * quoteLifetime) delete state.quotes[id]
          if (expiresAt > now && sameOwner(record.owner, owner) && record.signature === signature) {
            return record.quote
          }
        }
        const quoteId = crypto.randomUUID()
        const quote = { ...snapshot, quoteId, expiresAt: new Date(now + quoteLifetime).toISOString() }
        state.quotes[quoteId] = { owner, signature, quote }
        return quote
      })
      return HttpResponse.json<Quote>(quote)
    }),
  ),
  http.post<{ quoteId: string }, never, QuoteReview | ApiError>(`${apiBasePath}/quotes/:quoteId/review`, ({ params, request }) =>
    respondToMock(async () => {
      const reviewed = await updateMockState((state) => {
        requireSession(state, request)
        const { owner, cart } = resolveCart(state, request)
        const record = Object.hasOwn(state.quotes, params.quoteId) ? state.quotes[params.quoteId] : undefined
        if (!record || !sameOwner(record.owner, owner)) {
          throw new MockFailure(404, 'QUOTE_NOT_FOUND', 'Cotação não encontrada.')
        }
        const now = Date.now()
        if (Date.parse(record.quote.expiresAt) <= now) {
          throw new MockFailure(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores atualizados.')
        }
        const current = quoteSnapshot(state, cart, record.quote.network, now)
        if (JSON.stringify(current) !== record.signature) {
          throw new MockFailure(409, 'QUOTE_CHANGED', 'A cotação mudou. Revise os valores atualizados.')
        }
        if (current.issues.length) {
          throw new MockFailure(409, 'QUOTE_UNAVAILABLE', 'Resolva as pendências do carrinho para confirmar os valores.')
        }
        record.reviewedAt ??= new Date(now).toISOString()
        return { quoteId: record.quote.quoteId, reviewedAt: record.reviewedAt }
      })
      return HttpResponse.json<QuoteReview>(reviewed)
    }),
  ),
]
