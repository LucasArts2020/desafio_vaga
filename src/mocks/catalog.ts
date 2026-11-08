import { http, HttpResponse, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import {
  catalogSorts, nftCategories, nftNetworks,
  type CatalogItem, type CatalogPage, type Nft,
} from '@/contracts/catalog'
import { apiBasePath } from '@/lib/api'
import { parseEth } from '@/lib/eth'
import { apiError } from './api-error'
import { readMockState } from './repository'

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new RangeError('Página ou tamanho fora do intervalo permitido')
  }
  return parsed
}

function options<T extends string>(values: string[], allowed: readonly T[]) {
  return values.map((value) => {
    const option = allowed.find((item) => item === value)
    if (option === undefined) throw new RangeError('Opção de filtro ou ordem inválida')
    return option
  })
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function readCatalogParams(params: URLSearchParams) {
  const minPrice = params.get('minPrice')
  const maxPrice = params.get('maxPrice')
  const minWei = minPrice === null ? 0n : parseEth(minPrice)
  const maxWei = maxPrice === null ? undefined : parseEth(maxPrice)
  if (maxWei !== undefined && minWei > maxWei) throw new RangeError('Faixa de preço inválida')

  return {
    q: normalizeText(params.get('q')?.trim() ?? ''),
    collection: normalizeText(params.get('collection')?.trim() ?? ''),
    categories: options(params.getAll('category'), nftCategories),
    networks: options(params.getAll('network'), nftNetworks),
    sort: options([params.get('sort') ?? 'recent'], catalogSorts)[0],
    minWei,
    maxWei,
    page: positiveInteger(params.get('page'), 1, Number.MAX_SAFE_INTEGER),
    pageSize: positiveInteger(params.get('pageSize'), 3, 50),
  }
}

function summarize(nft: Nft): CatalogItem {
  const { id, title, artist, collection, category, network, createdAt, version } = nft
  const availableEditions = nft.editions.filter((edition) => edition.availableQuantity > 0)
  const candidates = availableEditions.length > 0 ? availableEditions : nft.editions
  const cheapest = candidates.reduce(
    (lowest, edition) => parseEth(edition.priceEth) < parseEth(lowest.priceEth) ? edition : lowest,
    candidates[0],
  )

  return {
    id, title, artist, collection, category, network, createdAt, version,
    priceEth: cheapest.priceEth,
    editionLabel: cheapest.label,
    cover: nft.media[0] ?? null,
    available: availableEditions.length > 0,
  }
}

export const catalogHandlers = [
  http.get<PathParams, never, CatalogPage | ApiError>(`${apiBasePath}/nfts`, async ({ request }) => {
    let query
    try {
      query = readCatalogParams(new URL(request.url).searchParams)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      return apiError(400, 'INVALID_CATALOG_QUERY', error.message)
    }

    const state = await readMockState()
    const nfts = state.scenario === 'empty' ? [] : state.nfts
    const collections = [...new Set(nfts.map((nft) => nft.collection))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    const featured = nfts.filter((nft) => nft.featured).map(summarize)
    const filtered = nfts.map(summarize).filter((item) => {
      const text = normalizeText(`${item.title} ${item.artist} ${item.collection}`)
      const wei = parseEth(item.priceEth)
      return text.includes(query.q)
        && (!query.collection || normalizeText(item.collection) === query.collection)
        && (!query.categories.length || query.categories.includes(item.category))
        && (!query.networks.length || query.networks.includes(item.network))
        && wei >= query.minWei
        && (query.maxWei === undefined || wei <= query.maxWei)
    })

    filtered.sort((a, b) => {
      if (query.sort === 'recent') {
        return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
      }

      const aWei = parseEth(a.priceEth)
      const bWei = parseEth(b.priceEth)
      if (aWei === bWei) return a.id.localeCompare(b.id)
      const direction = query.sort === 'price-asc' ? 1 : -1
      return (aWei < bWei ? -1 : 1) * direction
    })

    const start = (query.page - 1) * query.pageSize
    return HttpResponse.json<CatalogPage>({
      featured,
      collections,
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    })
  }),
  http.get<{ nftId: string }, never, Nft | ApiError>(`${apiBasePath}/nfts/:nftId`, async ({ params }) => {
    const { nfts } = await readMockState()
    const nft = nfts.find((item) => item.id === params.nftId)
    return nft
      ? HttpResponse.json<Nft>(nft)
      : apiError(404, 'NFT_NOT_FOUND', 'Obra não encontrada.')
  }),
]
