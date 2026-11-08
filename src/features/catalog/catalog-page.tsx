import { Link, getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Layers3 } from 'lucide-react'
import { useCallback, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { nftCategories, nftNetworks, type NftCategory } from '@/contracts/catalog'
import { displayEth } from '@/lib/eth'
import { Artwork } from './artwork'
import { useCatalog, type CatalogSearch } from './catalog-query'
import { CollectionRankingTable } from './collection-ranking'
import { FeaturedCollections } from './featured-collections'

const categories: Record<NftCategory, string> = {
  'arte-3d': 'Arte 3D',
  generativa: 'Generativa',
  fotografia: 'Fotografia',
  ilustracao: 'Ilustração',
}
const route = getRouteApi('/')

export function CatalogPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const overview = useCatalog({})
  const catalog = useCatalog(search)
  const data = catalog.data
  const featured = overview.data?.featured ?? []
  const collections = overview.data?.collections ?? []
  const page = search.page ?? 1
  const exploreCollection = useCallback((collection: string) => {
    void navigate({ to: '/', search: { collection }, hash: 'catalogo' })
  }, [navigate])

  function onSearch(next: CatalogSearch) {
    void navigate({ to: '/', search: next, hash: 'catalogo' })
  }

  function updateFilter(filter: Partial<CatalogSearch>) {
    onSearch({ ...search, ...filter, page: undefined })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    updateFilter({ q: q || undefined })
  }

  return (
    <div className="space-y-7 sm:space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Explore o Acervo</h1>
          <Badge variant="outline" className="border-border text-muted-foreground">Modo demo</Badge>
        </div>
        <div role="group" aria-label="Categorias do catálogo" className="flex flex-wrap gap-1.5">
          <Button variant={!search.category ? 'secondary' : 'ghost'} size="sm" className="h-11 px-3 sm:h-8"
            aria-pressed={!search.category} onClick={() => updateFilter({ category: undefined })}>
            <Layers3 aria-hidden="true" /> Todas as obras
          </Button>
          {nftCategories.map((category) => (
            <Button key={category} variant={search.category === category ? 'secondary' : 'ghost'} size="sm"
              className="h-11 px-3 sm:h-8" aria-pressed={search.category === category}
              onClick={() => updateFilter({ category })}>{categories[category]}</Button>
          ))}
        </div>
      </div>
      {featured.length > 0 && <FeaturedCollections slides={featured} explore={exploreCollection} />}
      {overview.isPending && <Skeleton className="h-64" role="status" aria-label="Carregando coleções em destaque" />}
      <CollectionRankingTable explore={exploreCollection} />

      <section id="catalogo" className="space-y-4 border-t border-border pt-5" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="text-xl font-semibold sm:text-2xl">Catálogo de NFTs</h2>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
          <form onSubmit={submitSearch} className="flex min-w-0 flex-[1_1_20rem] items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              Buscar obras
              <Input key={search.q ?? ''} name="q" type="search" defaultValue={search.q ?? ''} placeholder="Obra, artista ou coleção" className="mt-1 h-11 bg-background sm:h-9" />
            </label>
            <Button type="submit" className="h-11 sm:h-9">Buscar</Button>
          </form>
          <label className="text-sm">
            Categoria
            <select
              value={search.category ?? ''}
              onChange={(event) => updateFilter({ category: nftCategories.find((value) => value === event.target.value) })}
              className="field"
            >
              <option value="">Todas</option>
              {nftCategories.map((category) => <option key={category} value={category}>{categories[category]}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm">
            Coleção
            <select value={search.collection ?? ''} onChange={(event) => updateFilter({ collection: event.target.value || undefined })}
              className="field max-w-44">
              <option value="">Todas</option>
              {search.collection && !collections.includes(search.collection) && <option value={search.collection}>{search.collection}</option>}
              {collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Rede
            <select
              value={search.network ?? ''}
              onChange={(event) => updateFilter({ network: nftNetworks.find((value) => value === event.target.value) })}
              className="field capitalize"
            >
              <option value="">Todas</option>
              {nftNetworks.map((network) => <option key={network} value={network}>{network}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Ordenar
            <select
              value={search.sort ?? 'recent'}
              onChange={(event) => {
                const value = event.target.value
                updateFilter({ sort: value === 'price-asc' || value === 'price-desc' ? value : undefined })
              }}
              className="field"
            >
              <option value="recent">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </label>
        </div>

        {catalog.isPending && (
          <div aria-label="Carregando catálogo" role="status" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="aspect-[20/13]" />)}
          </div>
        )}
        {catalog.isError && (
          <div className="space-y-3">
            <p role="alert">O catálogo não pôde ser carregado.</p>
            <Button onClick={() => void catalog.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {data && (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">{data.total} obras · Página {data.page}</p>
            {data.items.length === 0 ? <p>Nenhuma obra encontrada.</p> : (
              <ul aria-label="Obras do catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
                {data.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/nfts/$nftId"
                      params={{ nftId: item.id }}
                      className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Card className="h-full gap-0 overflow-hidden border-border p-0 transition-colors hover:border-input motion-reduce:transition-none">
                        <Artwork media={item.cover} />
                        <CardContent className="space-y-2 px-3 py-3 sm:px-4">
                          <p className="text-xs text-muted-foreground">{item.collection}</p>
                          <h3 className="text-sm font-semibold sm:text-base">{item.title}</h3>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-medium tabular-nums sm:text-sm">{displayEth(item.priceEth)}</span>
                            <Badge variant={item.available ? 'secondary' : 'outline'}>
                              {item.available ? item.editionLabel : 'Esgotada'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => onSearch({ ...search, page: page > 2 ? page - 1 : undefined })}>
                <ChevronLeft aria-hidden="true" /> Página anterior
              </Button>
              <Button variant="outline" disabled={data.page * data.pageSize >= data.total} onClick={() => onSearch({ ...search, page: page + 1 })}>
                Próxima página <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
