import type { CartItem } from './cart'
import type { NftNetwork } from './catalog'
import type { EthDecimal } from '@/lib/eth'

export interface QuoteInput {
  expectedVersion: number
  network: NftNetwork
}

export interface QuoteIssue {
  code: 'EMPTY_CART' | 'QUANTITY_UNAVAILABLE' | 'COUPON_INVALID' | 'COUPON_EXPIRED' | 'NETWORK_UNAVAILABLE'
  message: string
  lineId?: string
}

export interface Quote {
  quoteId: string
  cartVersion: number
  network: NftNetwork
  couponCode: string | null
  lines: (CartItem & { nftVersion: number })[]
  issues: QuoteIssue[]
  subtotalEth: EthDecimal
  discountEth: EthDecimal
  networkFeeEth: EthDecimal
  totalEth: EthDecimal
  stablecoin?: { subtotal: string; discount: string; total: string }
  expiresAt: string
}

export interface QuoteReview {
  quoteId: string
  reviewedAt: string
}
