export const openSeaPath = '/api/opensea'

export const openSeaPeriods = ['24h', '7d', '30d'] as const
export type OpenSeaPeriod = typeof openSeaPeriods[number]

export interface OpenSeaPrice {
  amount: string
  currency: string
}

export interface OpenSeaNftRef {
  collection: string
  contract: string
  identifier: string
}

export function openSeaCartPrice(detail: OpenSeaNftDetail) {
  const listing = detail.listing
  if (!listing || !Number.isSafeInteger(listing.quantity) || listing.quantity === null || listing.quantity <= 0) return null
  const { currency, amount } = listing.price
  const supported = currency === 'ETH' && /^\d+(?:\.\d{1,18})?$/.test(amount)
    || detail.chain === 'polygon' && currency === 'USDC.e' && /^\d+(?:\.\d{1,6})?$/.test(amount)
  return supported ? { price: listing.price, quantity: listing.quantity } : null
}

export interface OpenSeaCollection {
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  bannerUrl: string | null
  openSeaUrl: string
  totalNfts: number | null
}

export interface OpenSeaNft extends OpenSeaNftRef {
  chain: 'ethereum' | 'polygon'
  name: string
  description: string | null
  imageUrl: string | null
  openSeaUrl: string
  price?: OpenSeaPrice
  collectionName?: string
}

export interface OpenSeaNftDetail extends OpenSeaNft {
  listing: { price: OpenSeaPrice; quantity: number | null } | null
}

export interface OpenSeaPage {
  collection: OpenSeaCollection | null
  featured?: OpenSeaCollection | null
  items: OpenSeaNft[]
  next: string | null
}

export interface OpenSeaRanking {
  period: OpenSeaPeriod
  items: (OpenSeaCollection & { volume: OpenSeaPrice | null; floor: OpenSeaPrice | null; sales: number | null; owners: number | null })[]
}

export interface OpenSeaSearchResults {
  items: ({ kind: 'collection'; collection: OpenSeaCollection } | { kind: 'nft'; nft: OpenSeaNft })[]
}
