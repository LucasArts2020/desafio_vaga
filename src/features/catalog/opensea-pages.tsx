import { useQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { openSeaCartPrice, openSeaPath, openSeaPeriods, type OpenSeaNft, type OpenSeaNftDetail, type OpenSeaPage, type OpenSeaPeriod, type OpenSeaPrice, type OpenSeaRanking, type OpenSeaSearchResults } from '@/contracts/opensea'
import { useCartMutation } from '@/features/cart/guest-cart'
import { api, apiProblem } from '@/lib/api'
import { Artwork } from './artwork'
import type { DiscoverySearch } from './opensea-search'

const catalogRoute = getRouteApi('/opensea')
const detailRoute = getRouteApi('/opensea/$contract/$identifier')

function useOpenSea<Result>(params: Omit<DiscoverySearch, 'view' | 'from'> & { contract?: string; identifier?: string; period?: OpenSeaPeriod; listed?: '1'; scope?: 'general' }) {
  return useQuery({
    queryKey: ['opensea', params],
    queryFn: async ({ signal }) => (await api.get<Result>(openSeaPath, { baseURL: '/', params, signal, timeout: params.period ? 20_000 : 14_000 })).data,
    staleTime: 60_000,
    retry: false,
  })
}

function DataSourceBadge() {
  return <Badge variant="outline" className="text-primary">Dados da OpenSea</Badge>
}

function OpenSeaError({ error, retry }: { error: unknown; retry: () => void }) {
  const problem = apiProblem(error)
  return (
    <div className="space-y-3">
      <p role="alert">{problem?.message ?? 'A consulta à OpenSea não pôde ser carregada.'}</p>
      {problem?.code === 'OPENSEA_DISABLED' && import.meta.env.VITE_ENABLE_MOCKS === 'true'
        ? <Button asChild variant="outline"><Link to="/">Abrir catálogo de demonstração</Link></Button>
        : <Button onClick={retry}>Tentar novamente</Button>}
    </div>
  )
}

function nftImage(nft: OpenSeaNft) {
  return nft.imageUrl ? { url: nft.imageUrl, alt: nft.name } : null
}

function priceLabel({ amount, currency }: OpenSeaPrice) {
  return `${amount.replace('.', ',')} ${currency}`
}

function DiscoveryHeading() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Explore o Acervo</h1>
      <DataSourceBadge />
    </div>
  )
}

function NftCard({ item, back }: { item: OpenSeaNft; back: DiscoverySearch }) {
  return (
    <Link to="/opensea/$contract/$identifier" params={{ contract: item.contract, identifier: item.identifier }}
      search={{ ...back, collection: item.collection, from: !back.collection && !back.q ? 'general' : undefined }} className="block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
      <Card className="h-full gap-0 overflow-hidden border-border p-0">
        <Artwork media={nftImage(item)} contain />
        <CardContent className="space-y-1 px-3 py-3 sm:px-4">
          {item.collectionName && <p className="truncate text-xs text-muted-foreground">{item.collectionName}</p>}
          <h3 className="break-words text-sm font-semibold sm:text-base">{item.name}</h3>
          <p className="break-words text-sm font-medium tabular-nums">{item.price ? priceLabel(item.price) : 'Consultar preço'}</p>
          {item.description && <p className="line-clamp-2 break-words text-xs text-muted-foreground">{item.description}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

function OpenSeaSearch({ q }: { q: string }) {
  const result = useOpenSea<OpenSeaSearchResults>({ q })
  return (
    <section id="catalogo" aria-labelledby="opensea-search-title" className="space-y-4">
      <h2 id="opensea-search-title" className="break-words text-xl font-semibold">Resultados para “{q}”</h2>
      {result.isPending && <Skeleton role="status" aria-label="Buscando NFTs e coleções" className="h-36" />}
      {result.isError && <OpenSeaError error={result.error} retry={() => void result.refetch()} />}
      {result.data && (result.data.items.length ? (
        <ul aria-label="Resultados da busca" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {result.data.items.map((item) => item.kind === 'nft' ? (
            <li key={`${item.nft.collection}/${item.nft.contract}/${item.nft.identifier}`}><NftCard item={item.nft} back={{ q }} /></li>
          ) : (
            <li key={item.collection.slug}>
              <Link to="/opensea" search={{ collection: item.collection.slug }} className="block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
                <Card className="h-full gap-0 overflow-hidden border-border p-0">
                  <Artwork media={item.collection.imageUrl ? { url: item.collection.imageUrl, alt: item.collection.name } : null} contain />
                  <CardContent className="space-y-1 px-3 py-3 sm:px-4">
                    <p className="text-xs text-muted-foreground">Coleção</p>
                    <h3 className="break-words text-sm font-semibold sm:text-base">{item.collection.name}</h3>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p>Nenhum NFT ou coleção encontrado.</p>)}
    </section>
  )
}

const statsFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 6 })
const numberFormat = new Intl.NumberFormat('pt-BR')
const periodLabels: Record<OpenSeaPeriod, string> = { '24h': '24h', '7d': '7 dias', '30d': '30 dias' }

function RankingPrice({ price }: { price: OpenSeaPrice | null }) {
  if (!price) return <span className="text-muted-foreground">—</span>
  return <>{statsFormat.format(Number(price.amount))} <span className="text-xs font-normal text-muted-foreground sm:text-sm">{price.currency}</span></>
}

function OpenSeaRankingTable() {
  const [period, setPeriod] = useState<OpenSeaPeriod>('24h')
  const ranking = useOpenSea<OpenSeaRanking>({ period })
  return (
    <section id="colecoes" aria-labelledby="live-ranking-title" className="space-y-4 pb-3 sm:space-y-6 sm:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="live-ranking-title" className="text-2xl font-semibold tracking-tight sm:text-4xl">Ranking de coleções</h2>
          <p className="text-sm text-muted-foreground">Coleções em destaque por volume de negociação.</p>
        </div>
        <div role="group" aria-label="Período de volume" className="inline-flex gap-1">
          {openSeaPeriods.map((option) => (
            <Button key={option} size="sm" aria-pressed={period === option} variant={period === option ? 'secondary' : 'ghost'}
              className="min-h-11 rounded-full px-4" onClick={() => setPeriod(option)}>{periodLabels[option]}</Button>
          ))}
        </div>
      </div>
      {ranking.isPending && <Skeleton role="status" aria-label="Carregando ranking" className="h-[37.5rem]" />}
      {ranking.isError && <OpenSeaError error={ranking.error} retry={() => void ranking.refetch()} />}
      {ranking.data && (ranking.data.items.length ? (
        <Table aria-label="Ranking de coleções" className="table-fixed tabular-nums sm:text-base">
          <TableHeader className="[&_tr]:border-0"><TableRow className="border-0 hover:bg-transparent [&_th]:text-sm [&_th]:text-muted-foreground">
            <TableHead className="w-8 pl-0 sm:w-12 sm:pl-2">#</TableHead>
            <TableHead>Coleção</TableHead>
            <TableHead className="w-28 pr-0 text-right sm:w-[22%] sm:pr-2 lg:w-[16%]">Preço mínimo</TableHead>
            <TableHead aria-sort="descending" className="hidden w-[22%] text-right sm:table-cell lg:w-[17%]">Volume</TableHead>
            <TableHead className="hidden w-[12%] text-right md:table-cell">Vendas</TableHead>
            <TableHead className="hidden w-[14%] text-right lg:table-cell">Proprietários</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {ranking.data.items.map((item, index) => (
              <TableRow key={item.slug} className="h-14 border-0 focus-within:bg-muted/50">
                <TableCell className="pl-0 text-muted-foreground sm:pl-2">{index + 1}</TableCell>
                <TableCell className="py-1.5">
                  <Link to="/opensea" search={{ collection: item.slug }} className="flex min-h-11 items-center gap-2 rounded-sm font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:gap-3">
                    <Avatar className="size-9 shrink-0 sm:size-10">
                      {item.imageUrl && <AvatarImage src={item.imageUrl} alt="" />}
                      <AvatarFallback>{item.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="line-clamp-2 min-w-0 whitespace-normal break-words">{item.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="pr-0 text-right font-medium sm:pr-2"><RankingPrice price={item.floor} /></TableCell>
                <TableCell className="hidden text-right font-medium sm:table-cell"><RankingPrice price={item.volume} /></TableCell>
                <TableCell className="hidden text-right md:table-cell">{item.sales == null ? '—' : numberFormat.format(item.sales)}</TableCell>
                <TableCell className="hidden text-right lg:table-cell">{item.owners === null ? '—' : numberFormat.format(item.owners)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p>Nenhuma coleção retornada neste período.</p>)}
    </section>
  )
}

export function OpenSeaCatalog() {
  const { collection, cursor, q, view } = catalogRoute.useSearch()
  return (
    <div className="space-y-7 sm:space-y-8">
      <DiscoveryHeading />
      {q ? <OpenSeaSearch q={q} /> : <OpenSeaCollectionCatalog collection={collection} cursor={cursor} view={view} />}
    </div>
  )
}

function OpenSeaCollectionCatalog({ collection, cursor, view }: DiscoverySearch) {
  const page = useOpenSea<OpenSeaPage>({ collection, cursor, listed: view === 'all' ? undefined : '1', scope: collection ? undefined : 'general' })
  const summary = page.data?.featured ?? page.data?.collection
  const banner = summary?.bannerUrl ?? summary?.imageUrl

  return (
    <>
      {summary && !cursor && (
        <section aria-label="Coleção em destaque" className="grid overflow-hidden rounded-lg border border-border bg-card md:grid-cols-2">
          <div className="space-y-3 p-5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Coleção em destaque</p>
            <h2 className="break-words text-2xl font-semibold sm:text-3xl">{summary.name}</h2>
            {summary.description && <p className="line-clamp-3 max-w-lg text-sm text-muted-foreground">{summary.description}</p>}
            <Button asChild><Link to="/opensea" search={{ collection: summary.slug, view }} hash="catalogo">Explorar coleção</Link></Button>
          </div>
          {banner && <img src={banner} alt="" width={600} height={240} referrerPolicy="no-referrer" className="h-44 w-full object-cover md:h-full md:max-h-72" />}
        </section>
      )}
      {!collection && !cursor && <OpenSeaRankingTable />}
      <section id="catalogo" aria-labelledby="opensea-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="opensea-title" className="text-xl font-semibold">Catálogo de NFTs</h2>
          <div aria-label="Exibição do catálogo" role="group" className="flex gap-1">
            <Button asChild size="sm" variant={view === 'all' ? 'ghost' : 'secondary'}>
              <Link to="/opensea" search={{ collection }} hash="catalogo" aria-current={view !== 'all' ? 'true' : undefined}>À venda</Link>
            </Button>
            <Button asChild size="sm" variant={view === 'all' ? 'secondary' : 'ghost'}>
              <Link to="/opensea" search={{ collection, view: 'all' }} hash="catalogo" aria-current={view === 'all' ? 'true' : undefined}>Todos os NFTs</Link>
            </Button>
          </div>
        </div>
        {page.isPending && (
          <div role="status" aria-label="Carregando catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="aspect-[20/13]" />)}
          </div>
        )}
        {page.isError && <OpenSeaError error={page.error} retry={() => void page.refetch()} />}
        {page.data && (
          <>
            {page.data.collection && (
              <p className="border-b border-input/60 pb-3 font-medium">{page.data.collection.name}{page.data.collection.totalNfts !== null && ` · ${numberFormat.format(page.data.collection.totalNfts)} NFTs`}</p>
            )}
            {page.data.items.length ? (
              <ul aria-label={collection ? 'NFTs da coleção' : 'NFTs de várias coleções'} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {page.data.items.map((item) => (
                  <li key={`${item.collection}/${item.contract}/${item.identifier}`}><NftCard item={item} back={{ collection, cursor, view }} /></li>
                ))}
              </ul>
            ) : <p>Nenhum NFT disponível nesta página.</p>}
            <div className="flex flex-wrap gap-2">
              {cursor && <Button asChild variant="outline"><Link to="/opensea" search={{ collection, view }} hash="catalogo">Primeira página</Link></Button>}
              {page.data.next && (
                <Button asChild><Link to="/opensea" search={{ collection, view, cursor: page.data.next }} hash="catalogo">Próxima página</Link></Button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}

export function OpenSeaDetail() {
  const { contract, identifier } = detailRoute.useParams()
  const { collection, cursor, q, view, from } = detailRoute.useSearch()
  const detail = useOpenSea<OpenSeaNftDetail>({ contract, identifier, collection })
  const nft = detail.data

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="min-h-11 text-muted-foreground">
          <Link to="/opensea" search={q ? { q } : { collection: from === 'general' ? undefined : collection, cursor, view }} hash="catalogo">
            <ArrowLeft aria-hidden="true" />
            {q ? 'Voltar aos resultados' : from === 'general' ? 'Voltar ao catálogo' : 'Voltar à coleção'}
          </Link>
        </Button>
      </div>
      {detail.isPending && <div role="status" aria-label="Carregando NFT" className="skeleton aspect-[20/13] max-w-xl rounded-md" />}
      {detail.isError && <OpenSeaError error={detail.error} retry={() => void detail.refetch()} />}
      {nft && (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Artwork media={nftImage(nft)} contain eager />
          <div className="min-w-0 space-y-5">
            <DataSourceBadge />
            <h1 className="break-words text-4xl font-semibold tracking-tight">{nft.name}</h1>
            {nft.listing && <p className="break-words text-xl font-semibold text-primary tabular-nums">{priceLabel(nft.listing.price)}</p>}
            {nft.description && <p className="max-w-prose break-words text-muted-foreground">{nft.description}</p>}
            <OpenSeaCartAction key={`${nft.collection}/${nft.contract}/${nft.identifier}`} nft={nft} />
          </div>
        </div>
      )}
    </section>
  )
}

function OpenSeaCartAction({ nft }: { nft: OpenSeaNftDetail }) {
  const add = useCartMutation()
  if (!openSeaCartPrice(nft)) return (
    <div className="space-y-2">
      <Button disabled>Adicionar ao carrinho</Button>
      <p className="text-sm text-muted-foreground">
        {nft.listing ? 'O carrinho aceita anúncios disponíveis em ETH ou USDC.e na rede Polygon.' : 'Este NFT está sem anúncio ativo.'}
      </p>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={add.isPending} onClick={() => add.mutate({
          type: 'add', quantity: 1, openSea: { collection: nft.collection, contract: nft.contract, identifier: nft.identifier },
        })}>{add.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}</Button>
        {add.isSuccess && <Button asChild variant="outline"><Link to="/carrinho">Ver carrinho</Link></Button>}
      </div>
      {add.isSuccess && <p role="status" className="text-sm text-primary">NFT adicionado ao carrinho de demonstração.</p>}
      {add.isError && <p role="alert" className="text-sm text-destructive">{apiProblem(add.error)?.message ?? 'Não foi possível adicionar o NFT.'}</p>}
    </div>
  )
}
