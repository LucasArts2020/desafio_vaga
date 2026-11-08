import { useQuery } from '@tanstack/react-query'
import {
  catalogSorts, nftCategories, nftNetworks,
  type CatalogPage, type CatalogSort, type Nft, type NftCategory, type NftNetwork,
} from '@/contracts/catalog'
import { api, retryApiRead } from '@/lib/api'

export interface CatalogSearch {
  q?: string
  category?: NftCategory
  collection?: string
  network?: NftNetwork
  sort?: CatalogSort
  page?: number
}

export function validateCatalogSearch(input: Record<string, unknown>): CatalogSearch {
  const q = typeof input.q === 'string' || typeof input.q === 'number' ? String(input.q).trim() : ''
  const category = nftCategories.find((item) => item === input.category)
  const collection = typeof input.collection === 'string' ? input.collection.trim().slice(0, 80) : ''
  const network = nftNetworks.find((item) => item === input.network)
  const sort = catalogSorts.find((item) => item === input.sort)
  const page = typeof input.page === 'number' && Number.isSafeInteger(input.page) && input.page > 1
    ? input.page
    : undefined

  return { q: q || undefined, category, collection: collection || undefined, network, sort: sort === 'recent' ? undefined : sort, page }
}

export function useCatalog(search: CatalogSearch) {
  const params = { ...search, page: search.page ?? 1 }
  return useQuery({
    queryKey: ['catalog', 'list', params],
    queryFn: async ({ signal }) => (await api.get<CatalogPage>('/nfts', { params, signal })).data,
    staleTime: 30_000,
    retry: retryApiRead,
  })
}

export function useNft(nftId: string) {
  return useQuery({
    queryKey: ['catalog', 'detail', nftId],
    queryFn: async ({ signal }) => (await api.get<Nft>(`/nfts/${encodeURIComponent(nftId)}`, { signal })).data,
    staleTime: 30_000,
    retry: retryApiRead,
  })
}
