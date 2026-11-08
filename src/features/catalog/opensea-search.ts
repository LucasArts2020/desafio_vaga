export type DiscoverySearch = { collection?: string; cursor?: string; q?: string; view?: 'all'; from?: 'general' }

export function validateOpenSeaSearch(search: Record<string, unknown>): DiscoverySearch {
  const { collection, cursor, q } = search
  const term = typeof q === 'string' || typeof q === 'number' ? String(q).trim().slice(0, 100) : ''
  return {
    collection: typeof collection === 'string' && /^[a-z\d-]{1,100}$/.test(collection) ? collection : undefined,
    cursor: typeof cursor === 'string' && cursor && cursor.length <= 2048 ? cursor : undefined,
    q: term || undefined,
    view: search.view === 'all' ? 'all' : undefined,
    from: search.from === 'general' ? 'general' : undefined,
  }
}
