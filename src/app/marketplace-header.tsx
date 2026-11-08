import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Asterisk, Menu, Search, ShoppingBag } from 'lucide-react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { AuthNavigation } from '@/features/auth/auth-navigation'
import { useCart } from '@/features/cart/guest-cart'
import { validateCatalogSearch } from '@/features/catalog/catalog-query'

const homeLinks = [
  { label: 'Início', hash: undefined },
  { label: 'Explorar NFTs', hash: 'catalogo' },
  { label: 'Coleções', hash: 'colecoes' },
] as const
const demoEnabled = import.meta.env.VITE_ENABLE_MOCKS === 'true'

function CommerceActions() {
  const cart = useCart()
  const quantity = cart.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
  return (
    <>
      <Button asChild variant="ghost" className="h-11 min-w-11 gap-1.5 px-2.5">
        <Link to="/carrinho" aria-label={quantity > 0 ? `Carrinho, ${quantity} ${quantity === 1 ? 'item' : 'itens'}` : 'Carrinho'}>
          <ShoppingBag aria-hidden="true" />
          {quantity > 0 && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs tabular-nums text-primary">{quantity}</span>}
        </Link>
      </Button>
      <AuthNavigation />
    </>
  )
}

export function MarketplaceHeader() {
  const locationSearch = useRouterState({ select: (state) => state.location.search })
  const search = validateCatalogSearch(locationSearch)
  const navigate = useNavigate()
  const target = demoEnabled ? '/' : '/opensea'

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    if (!demoEnabled) {
      void navigate({ to: '/opensea', search: { q: q || undefined }, hash: 'catalogo' })
      return
    }
    void navigate({ to: '/', search: { ...search, q: q || undefined, page: undefined }, hash: 'catalogo' })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <nav aria-label="Navegação principal" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <Link to="/" search={{}} className="flex min-h-11 shrink-0 items-center gap-2 rounded-sm text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring">
          <span className="grid size-7 place-items-center rounded-md bg-primary/12 text-primary">
            <Asterisk className="size-5" aria-hidden="true" />
          </span>
          Acervo
        </Link>
        <div className="hidden items-center gap-4 text-sm font-medium xl:flex">
          {homeLinks.map(({ label, hash }) => (
            <Link key={label} to={target} search={{}} hash={hash} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              {label}
            </Link>
          ))}
          {demoEnabled && <Link to="/opensea" search={{}} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            Catálogo ao vivo
          </Link>}
        </div>
        <form role="search" aria-label="Busca global" onSubmit={submitSearch}
          className="order-last flex w-full min-w-0 items-center gap-1 rounded-md border border-border bg-card px-1 md:order-none md:ml-2 md:w-auto md:flex-1">
          <label htmlFor="global-search" className="sr-only">Buscar no Acervo</label>
          <Input id="global-search" key={search.q ?? ''} name="q" type="search" defaultValue={search.q ?? ''}
            maxLength={100} placeholder={demoEnabled ? 'Buscar NFT, coleção ou artista' : 'Buscar NFT ou coleção'} className="h-11 min-w-0 border-0 bg-transparent px-3 shadow-none md:h-9" />
          <Button type="submit" variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" aria-label="Buscar no catálogo">
            <Search aria-hidden="true" />
          </Button>
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 xl:hidden" aria-label="Menu principal"><Menu aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {homeLinks.map(({ label, hash }) => (
                <DropdownMenuItem key={label} asChild><Link to={target} search={{}} hash={hash}>{label}</Link></DropdownMenuItem>
              ))}
              {demoEnabled && <DropdownMenuItem asChild><Link to="/opensea" search={{}}>Catálogo ao vivo</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <CommerceActions />
        </div>
      </nav>
    </header>
  )
}
