import type { EthDecimal } from '@/lib/eth'

export const nftCategories = ['arte-3d', 'generativa', 'fotografia', 'ilustracao'] as const
export const nftNetworks = ['ethereum', 'polygon'] as const
export const catalogSorts = ['recent', 'price-asc', 'price-desc'] as const

export type NftCategory = typeof nftCategories[number]
export type NftNetwork = typeof nftNetworks[number]
export type CatalogSort = typeof catalogSorts[number]

export interface NftMedia {
  url: string
  alt: string
}

export interface NftEdition {
  id: string
  label: string
  priceEth: EthDecimal
  availableQuantity: number
}

export interface Nft {
  id: string
  title: string
  artist: string
  collection: string
  description: string
  category: NftCategory
  network: NftNetwork
  createdAt: string
  featured: boolean
  version: number
  media: NftMedia[]
  editions: [NftEdition, ...NftEdition[]]
}

export type CatalogItem = Pick<
  Nft,
  'id' | 'title' | 'artist' | 'collection' | 'category' | 'network' | 'createdAt' | 'version'
> & {
  cover: NftMedia | null
  priceEth: EthDecimal
  editionLabel: string
  available: boolean
}

export interface CatalogPage {
  items: CatalogItem[]
  featured: CatalogItem[]
  collections: string[]
  total: number
  page: number
  pageSize: number
}
