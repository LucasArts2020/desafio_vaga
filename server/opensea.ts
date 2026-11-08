import type { ApiError } from '../src/contracts/api-error.ts'
import { openSeaPeriods, type OpenSeaCollection, type OpenSeaNft, type OpenSeaNftDetail, type OpenSeaPage, type OpenSeaPeriod, type OpenSeaRanking, type OpenSeaSearchResults } from '../src/contracts/opensea.ts'

const upstreamOrigin = 'https://api.opensea.io'
const cacheTime = 60_000
const contractPattern = /^0x[\da-f]{40}$/i
const identifierPattern = /^\d{1,78}$/
const slugPattern = /^[a-z\d-]{1,100}$/
const rankingLimit = 10
const rankingStatsBatchSize = 5
const rankingWindows: Record<OpenSeaPeriod, { sort: string; interval: string }> = {
  '24h': { sort: 'one_day_volume', interval: 'one_day' },
  '7d': { sort: 'seven_days_volume', interval: 'seven_day' },
  '30d': { sort: 'thirty_days_volume', interval: 'thirty_day' },
}

class ProxyError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: string

  constructor(status: number, code: string, message: string, retryAfter?: string) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function httpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

function sourceUrl(value: unknown) {
  const url = httpsUrl(value)
  return url && (url.hostname === 'opensea.io' || url.hostname === 'www.opensea.io') ? url : null
}

function shortDescription(value: unknown) {
  const words = text(value, 1000).replace(/\s+/g, ' ')
  if (words.length <= 140) return words || null
  return `${Array.from(words).slice(0, 139).join('').replace(/\s+\S*$/, '')}…`
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function mapCollection(value: unknown, slug: string): OpenSeaCollection | null {
  const collection = record(value)
  if (collection.is_disabled || collection.is_nsfw) return null
  return {
    slug,
    name: text(collection.name, 200) || slug,
    description: text(collection.description, 6000) || null,
    imageUrl: httpsUrl(collection.image_url)?.href ?? null,
    bannerUrl: httpsUrl(collection.banner_image_url)?.href ?? null,
    openSeaUrl: `https://opensea.io/collection/${slug}`,
    totalNfts: count(collection.unique_item_count),
  }
}

function mapNft(
  value: unknown,
  slug: string,
  contracts: Map<string, OpenSeaNft['chain']>,
): OpenSeaNft | null {
  const nft = record(value)
  const contract = typeof nft.contract === 'string' ? nft.contract.toLowerCase() : ''
  const identifier = typeof nft.identifier === 'string' ? nft.identifier : ''
  const chain = contracts.get(contract)
  if (nft.collection !== slug || !chain || !identifierPattern.test(identifier) || nft.is_disabled || nft.is_nsfw) return null

  return {
    collection: slug,
    contract,
    identifier,
    chain,
    name: text(nft.name, 200) || `NFT #${identifier}`,
    description: shortDescription(nft.description),
    imageUrl: (httpsUrl(nft.display_image_url) ?? httpsUrl(nft.image_url))?.href ?? null,
    openSeaUrl: sourceUrl(nft.opensea_url)?.href ?? `https://opensea.io/collection/${slug}`,
  }
}

function mapListing(value: unknown, nft: Pick<OpenSeaNft, 'chain' | 'contract' | 'identifier'>): OpenSeaNftDetail['listing'] {
  const listing = record(value)
  const asset = record(listing.asset)
  if (listing.chain !== nft.chain || typeof asset.contract !== 'string' || asset.contract.toLowerCase() !== nft.contract
    || asset.identifier !== nft.identifier || listing.status !== 'ACTIVE') return null
  const quantity = count(listing.remaining_quantity)
  if (quantity === 0) return null
  const price = record(listing.price_per_item ?? (quantity === 1 ? record(listing.price).current : undefined))
  const { decimals, value: atomic } = price
  const currency = text(price.currency, 16)
  if (!currency || typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36
    || typeof atomic !== 'string' || !/^\d{1,78}$/.test(atomic)) return null
  const digits = BigInt(atomic).toString().padStart(decimals + 1, '0')
  const whole = decimals ? digits.slice(0, -decimals) : digits
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, '') : ''
  return { price: { amount: fraction ? `${whole}.${fraction}` : whole, currency }, quantity }
}

function statPrice(value: unknown, symbol: unknown) {
  const currency = text(symbol, 16)
  return currency && typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? { amount: String(value), currency }
    : null
}

function collectionContracts(entries: unknown[]) {
  const contracts = new Map<string, OpenSeaNft['chain']>()
  for (const entry of entries) {
    const { chain, address } = record(entry)
    if ((chain === 'ethereum' || chain === 'polygon') && typeof address === 'string' && contractPattern.test(address)) {
      const contract = address.toLowerCase()
      const previous = contracts.get(contract)
      if (previous && previous !== chain) {
        throw new ProxyError(502, 'OPENSEA_UNSUPPORTED_COLLECTION', 'A coleção possui um endereço compartilhado entre redes.')
      }
      contracts.set(contract, chain)
    }
  }
  return contracts
}

function pageCursor(value: unknown) {
  return typeof value === 'string' && value.length <= 2048 ? value || null : null
}

function apiError(error: ProxyError) {
  return Response.json({
    code: error.code,
    message: error.message,
    requestId: crypto.randomUUID(),
  } satisfies ApiError, {
    status: error.status,
    headers: { 'Cache-Control': 'no-store', ...(error.retryAfter ? { 'Retry-After': error.retryAfter } : {}) },
  })
}

export function createOpenSeaHandler(
  options: { apiKey?: string; collection?: string },
  upstreamFetch: typeof fetch = fetch,
) {
  const apiKey = options.apiKey?.trim()
  const defaultSlug = options.collection?.trim() || 'doodles-official'
  const cache = new Map<string, { expiresAt: number; pending: Promise<unknown> }>()

  async function requestOpenSea(path: string, body?: string) {
    const key = body ? `${path} ${body}` : path
    const previous = cache.get(key)
    if (previous && previous.expiresAt > Date.now()) return previous.pending

    const pending = (async () => {
      const response = await upstreamFetch(new URL(path, upstreamOrigin), {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/json', 'X-API-KEY': apiKey!, ...(body && { 'Content-Type': 'application/json' }) },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(6_000),
      })
      if (response.status === 429) {
        throw new ProxyError(429, 'OPENSEA_RATE_LIMIT', 'A OpenSea limitou temporariamente as consultas. Tente novamente em instantes.', response.headers.get('Retry-After') ?? undefined)
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProxyError(502, 'OPENSEA_AUTH_FAILED', 'A OpenSea recusou a credencial configurada no servidor.')
      }
      if (response.status === 404) throw new ProxyError(404, 'OPENSEA_NOT_FOUND', 'Recurso não encontrado na OpenSea.')
      if (!response.ok) throw new ProxyError(502, 'OPENSEA_UNAVAILABLE', 'A OpenSea está indisponível no momento.')
      return await response.json() as unknown
    })()

    if (cache.size >= 64) cache.delete(cache.keys().next().value!)
    cache.set(key, { expiresAt: Date.now() + cacheTime, pending })
    try {
      return await pending
    } catch (error) {
      if (cache.get(key)?.pending === pending) cache.delete(key)
      throw error
    }
  }

  async function listedPage(slug: string, contracts: Map<string, OpenSeaNft['chain']>, cursor: string | null, limit = 12) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('next', cursor)
    const page = record(await requestOpenSea(`/api/v2/listings/collection/${slug}/best?${params}`))
    if (!Array.isArray(page.listings)) throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu os anúncios em formato inesperado.')
    const listings = new Map<string, { chain: OpenSeaNft['chain']; contract: string; identifier: string; price: NonNullable<OpenSeaNftDetail['listing']>['price'] }>()
    for (const entry of page.listings as unknown[]) {
      const asset = record(record(entry).asset)
      const contract = typeof asset.contract === 'string' ? asset.contract.toLowerCase() : ''
      const chain = contracts.get(contract)
      const identifier = typeof asset.identifier === 'string' ? asset.identifier : ''
      if (!chain || !identifierPattern.test(identifier)) continue
      const key = `${contract}/${identifier}`
      const listing = mapListing(entry, { chain, contract, identifier })
      if (listing && !listings.has(key)) listings.set(key, { chain, contract, identifier, price: listing.price })
    }
    const items: OpenSeaNft[] = []
    if (listings.size) {
      const identifiers = [...listings.values()].map(({ chain, contract, identifier }) => ({ chain, contract_address: contract, token_id: identifier }))
      const batch = record(await requestOpenSea('/api/v2/nfts/batch', JSON.stringify({ identifiers })))
      if (!Array.isArray(batch.nfts)) throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu os NFTs em formato inesperado.')
      const metadata = new Map<string, OpenSeaNft>()
      for (const entry of batch.nfts as unknown[]) {
        const item = mapNft(entry, slug, contracts)
        if (item) metadata.set(`${item.contract}/${item.identifier}`, item)
      }
      for (const [key, listing] of listings) {
        const item = metadata.get(key)
        if (item) items.push({ ...item, price: listing.price })
      }
    }
    return { items, next: pageCursor(page.next) }
  }

  async function nftPage(slug: string, contracts: Map<string, OpenSeaNft['chain']>, cursor: string | null, limit = 12) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('next', cursor)
    const upstream = record(await requestOpenSea(`/api/v2/collection/${slug}/nfts?${params}`))
    if (!Array.isArray(upstream.nfts)) {
      throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu uma listagem em formato inesperado.')
    }
    const items = (upstream.nfts as unknown[]).flatMap((value) => {
      const nft = mapNft(value, slug, contracts)
      return nft ? [nft] : []
    })
    return { items, next: pageCursor(upstream.next) }
  }

  async function generalPage(cursor: string | null, listed: boolean): Promise<OpenSeaPage> {
    const params = new URLSearchParams({ sort_by: rankingWindows['24h'].sort, chains: 'ethereum,polygon', limit: '4' })
    if (cursor) params.set('cursor', cursor)
    const [page, featured] = await Promise.all([
      requestOpenSea(`/api/v2/collections/top?${params}`).then(record),
      cursor ? null : requestOpenSea(`/api/v2/collections/${defaultSlug}`).then((value) => mapCollection(value, defaultSlug)).catch(() => null),
    ])
    if (!Array.isArray(page.collections)) throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu as coleções em formato inesperado.')
    const groups = await Promise.all((page.collections as unknown[]).slice(0, 4).map(async (value) => {
      const { collection: slug, contracts: entries } = record(value)
      if (typeof slug !== 'string' || !slugPattern.test(slug) || !Array.isArray(entries)) return []
      const collection = mapCollection(value, slug)
      if (!collection) return []
      const contracts = collectionContracts(entries)
      if (!contracts.size) return []
      const batch = await (listed ? listedPage(slug, contracts, null, 8) : nftPage(slug, contracts, null, 3)).catch((error: unknown) => {
        if (error instanceof ProxyError && error.status === 404) return { items: [] }
        throw error
      })
      return batch.items.slice(0, 3).map((item) => ({ ...item, collectionName: collection.name }))
    }))
    return { collection: null, featured, items: groups.flat(), next: pageCursor(page.next) }
  }

  async function ranking(period: OpenSeaPeriod): Promise<OpenSeaRanking> {
    const { sort, interval } = rankingWindows[period]
    const payload = record(await requestOpenSea(`/api/v2/collections/top?sort_by=${sort}&chains=ethereum,polygon&limit=${rankingLimit}`))
    if (!Array.isArray(payload.collections)) throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu um ranking em formato inesperado.')
    const collections = (payload.collections as unknown[]).flatMap((value) => {
      const { collection } = record(value)
      if (typeof collection !== 'string' || !slugPattern.test(collection)) return []
      const mapped = mapCollection(value, collection)
      return mapped ? [mapped] : []
    })
    async function addStats(collection: OpenSeaCollection): Promise<OpenSeaRanking['items'][number]> {
      const stats = record(await requestOpenSea(`/api/v2/collections/${collection.slug}/stats`).catch((error: unknown) => {
        if (error instanceof ProxyError && (error.status === 404 || error.status === 429)) return null
        throw error
      }))
      const intervals: unknown[] = Array.isArray(stats.intervals) ? stats.intervals : []
      const current = record(intervals.find((value) => record(value).interval === interval))
      const total = record(stats.total)
      return {
        ...collection,
        volume: statPrice(current.volume, current.volume_symbol),
        floor: total.floor_price === 0 ? null : statPrice(total.floor_price, total.floor_price_symbol),
        sales: count(current.sales),
        owners: count(total.num_owners),
      }
    }
    const items: OpenSeaRanking['items'] = []
    const topCollections = collections.slice(0, rankingLimit)
    for (let index = 0; index < topCollections.length; index += rankingStatsBatchSize) {
      items.push(...await Promise.all(topCollections.slice(index, index + rankingStatsBatchSize).map(addStats)))
    }
    return { period, items }
  }

  async function search(q: string): Promise<OpenSeaSearchResults> {
    const params = new URLSearchParams({ query: q, chains: 'ethereum,polygon', limit: '16' })
    params.append('asset_types', 'collection')
    params.append('asset_types', 'nft')
    const payload = record(await requestOpenSea(`/api/v2/search?${params}`))
    if (!Array.isArray(payload.results)) throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu a busca em formato inesperado.')
    const items: OpenSeaSearchResults['items'] = []
    for (const value of payload.results as unknown[]) {
      const result = record(value)
      const entity = record(result.type === 'collection' ? result.collection : result.nft)
      const { collection, contract } = entity
      if (typeof collection !== 'string' || !slugPattern.test(collection)) continue
      if (result.type === 'collection') {
        const item = mapCollection(entity, collection)
        if (item) items.push({ kind: 'collection', collection: item })
      } else if (result.type === 'nft' && typeof contract === 'string' && contractPattern.test(contract)) {
        const [, section, network] = sourceUrl(entity.opensea_url)?.pathname.split('/') ?? []
        const chain = network === 'matic' ? 'polygon' : network
        if (section !== 'assets' || (chain !== 'ethereum' && chain !== 'polygon')) continue
        const nft = mapNft(entity, collection, new Map([[contract.toLowerCase(), chain]]))
        if (nft) {
          const { price, currency } = record(entity.best_listing)
          if (typeof price === 'string' && /^\d{1,78}(?:\.\d{1,36})?$/.test(price) && typeof currency === 'string' && currency.length <= 16 && currency) {
            nft.price = { amount: price, currency }
          }
          items.push({ kind: 'nft', nft })
        }
      }
    }
    return { items }
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      const response = apiError(new ProxyError(405, 'METHOD_NOT_ALLOWED', 'Use GET para consultar o catálogo.'))
      response.headers.set('Allow', 'GET')
      return response
    }

    try {
      if (!apiKey) throw new ProxyError(503, 'OPENSEA_DISABLED', 'Configure OPENSEA_API_KEY no servidor para consultar o catálogo ao vivo.')
      const query = new URL(request.url).searchParams
      const slug = query.get('collection') ?? defaultSlug
      if (!slugPattern.test(slug)) throw new ProxyError(400, 'OPENSEA_COLLECTION_INVALID', 'Informe um slug de coleção válido.')
      const contract = query.get('contract')?.toLowerCase()
      const identifier = query.get('identifier')
      const cursor = query.get('cursor')
      const period = query.get('period')
      const q = query.get('q')?.trim()
      const listed = query.get('listed')
      const scope = query.get('scope')
      const detail = contract !== undefined || identifier !== null
      const headers = { 'Cache-Control': 'public, max-age=0, s-maxage=60' }
      if (period !== null || q !== undefined) {
        if (detail || cursor !== null || listed !== null || scope !== null || query.has('collection') || (period !== null && q !== undefined)) {
          throw new ProxyError(400, 'OPENSEA_INVALID_QUERY', 'Use busca ou ranking em uma consulta separada.')
        }
        if (period !== null) {
          const selected = openSeaPeriods.find((item) => item === period)
          if (!selected) throw new ProxyError(400, 'OPENSEA_INVALID_QUERY', 'Selecione um período disponível na OpenSea.')
          return Response.json(await ranking(selected), { headers })
        }
        if (!q || q.length > 100) throw new ProxyError(400, 'OPENSEA_INVALID_QUERY', 'Informe um termo de busca de até 100 caracteres.')
        return Response.json(await search(q), { headers })
      }
      if ((detail && (!contract || !contractPattern.test(contract) || !identifier || !identifierPattern.test(identifier) || cursor !== null || listed !== null))
        || (listed !== null && listed !== '1') || (scope !== null && (scope !== 'general' || detail || query.has('collection')))
        || (cursor !== null && (!cursor || cursor.length > 2048))) {
        throw new ProxyError(400, 'OPENSEA_INVALID_QUERY', 'Informe um NFT ou cursor válido.')
      }

      if (scope === 'general') return Response.json(await generalPage(cursor, listed === '1'), { headers })

      const collection = record(await requestOpenSea(`/api/v2/collections/${slug}`))
      const summary = mapCollection(collection, slug)
      if (!summary) throw new ProxyError(404, 'OPENSEA_NOT_FOUND', 'Coleção indisponível na OpenSea.')
      if (!Array.isArray(collection.contracts)) {
        throw new ProxyError(502, 'OPENSEA_BAD_RESPONSE', 'A OpenSea devolveu uma coleção em formato inesperado.')
      }
      const contracts = collectionContracts(collection.contracts)
      if (contracts.size === 0) {
        throw new ProxyError(502, 'OPENSEA_UNSUPPORTED_COLLECTION', 'A coleção precisa ter um contrato Ethereum ou Polygon.')
      }

      if (contract && identifier) {
        const chain = contracts.get(contract)
        if (!chain) throw new ProxyError(404, 'OPENSEA_NOT_FOUND', 'NFT fora da coleção configurada.')
        const upstream = record(await requestOpenSea(`/api/v2/chain/${chain}/contract/${contract}/nfts/${identifier}`))
        const nft = mapNft(upstream.nft, slug, contracts)
        if (!nft || nft.contract !== contract || nft.identifier !== identifier) {
          throw new ProxyError(404, 'OPENSEA_NOT_FOUND', 'NFT não encontrado nesta coleção.')
        }
        const listing = await requestOpenSea(`/api/v2/listings/collection/${slug}/nfts/${identifier}/best`).catch((error: unknown) => {
          if (error instanceof ProxyError && error.status === 404) return null
          throw error
        })
        return Response.json({ ...nft, listing: mapListing(listing, nft) } satisfies OpenSeaNftDetail, { headers })
      }

      const page = await (listed === '1' ? listedPage(slug, contracts, cursor) : nftPage(slug, contracts, cursor))
      return Response.json({ collection: summary, ...page } satisfies OpenSeaPage, { headers })
    } catch (error) {
      if (error instanceof ProxyError) return apiError(error)
      if (error instanceof Error && error.name === 'TimeoutError') {
        return apiError(new ProxyError(504, 'OPENSEA_TIMEOUT', 'A consulta à OpenSea demorou além do esperado.'))
      }
      return apiError(new ProxyError(502, 'OPENSEA_UNAVAILABLE', 'A OpenSea está indisponível no momento.'))
    }
  }
}
