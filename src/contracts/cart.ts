import type { NftMedia } from '@/contracts/catalog'
import type { OpenSeaNftRef } from '@/contracts/opensea'
import type { EthDecimal } from '@/lib/eth'

export const guestCartHeader = 'X-Guest-Cart'

export interface CartItem {
  id: string
  nftId: string
  editionId: string
  title: string
  editionLabel: string
  cover: NftMedia | null
  quantity: number
  availableQuantity: number
  priceEth: EthDecimal
  subtotalEth: EthDecimal
  stablecoin?: { price: string; subtotal: string }
  openSea?: OpenSeaNftRef
}

export interface Cart {
  version: number
  items: CartItem[]
  subtotalEth: EthDecimal
  couponCode: string | null
}

export interface GuestCartSession {
  token: string
  cart: Cart
}

export interface CartVersion {
  expectedVersion: number
}

export type CartSelection = { nftId: string; editionId: string } | { openSea: OpenSeaNftRef }

export type AddCartItem = CartVersion & CartSelection & {
  quantity: number
}

export interface UpdateCartItem extends CartVersion {
  quantity: number
}
