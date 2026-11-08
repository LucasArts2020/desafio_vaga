import { Link, Outlet, createRootRoute, createRoute, createRouter, lazyRouteComponent, notFound, redirect, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { AuthPage } from '@/features/auth/auth-page'
import { validateAuthSearch } from '@/features/auth/return-to'
import { sessionOptions } from '@/features/auth/session-query'
import { validateCatalogSearch } from '@/features/catalog/catalog-query'
import { NftDetail } from '@/features/catalog/nft-detail'
import { validateOpenSeaSearch } from '@/features/catalog/opensea-search'
import { sessionExpired, sessionToken } from '@/lib/session-token'
import { MarketplaceHeader } from './marketplace-header'
import { queryClient } from './query-client'

const demoEnabled = import.meta.env.VITE_ENABLE_MOCKS === 'true'

function requireDemo() {
  if (!demoEnabled) throw notFound()
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-input/70">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-6 py-5 text-xs text-muted-foreground">
          <span>Acervo — Uma nova forma de colecionar.</span>
          {demoEnabled && (
            <Link to="/integracao" className="underline underline-offset-4">Verificar integração</Link>
          )}
        </div>
      </footer>
    </>
  ),
  notFoundComponent: () => (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Página não encontrada</h1>
      <Button asChild><Link to="/">Voltar ao início</Link></Button>
    </section>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  beforeLoad: ({ location }) => {
    if (!demoEnabled) throw redirect({ to: '/opensea', search: validateOpenSeaSearch(location.search), hash: location.hash, replace: true })
  },
  component: lazyRouteComponent(() => import('@/features/catalog/catalog-page'), 'CatalogPage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$nftId',
  beforeLoad: requireDemo,
  component: function Nft() {
    const { nftId } = nftRoute.useParams()
    return <NftDetail nftId={nftId} />
  },
})

const openSeaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/opensea',
  validateSearch: validateOpenSeaSearch,
  component: lazyRouteComponent(() => import('@/features/catalog/opensea-pages'), 'OpenSeaCatalog'),
})

const openSeaDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/opensea/$contract/$identifier',
  validateSearch: validateOpenSeaSearch,
  component: lazyRouteComponent(() => import('@/features/catalog/opensea-pages'), 'OpenSeaDetail'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateAuthSearch,
  component: function Login() {
    const { returnTo, expired } = loginRoute.useSearch()
    return <AuthPage register={false} returnTo={returnTo} expired={expired} />
  },
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  component: function Register() {
    const { returnTo, expired } = registerRoute.useSearch()
    return <AuthPage register returnTo={returnTo} expired={expired} />
  },
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  async beforeLoad() {
    const token = sessionToken()
    if (token) {
      try {
        await queryClient.fetchQuery(sessionOptions(token))
        if (sessionToken() === token) return
      } catch (error) {
        if (sessionToken() === token) throw error
      }
    }
    throw redirect({
      to: '/login',
      search: { returnTo: '/checkout', expired: sessionExpired() || undefined },
      replace: true,
    })
  },
  component: lazyRouteComponent(() => import('@/features/cart/checkout-review'), 'CheckoutReview'),
  errorComponent: function CheckoutError() {
    const router = useRouter()
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Não foi possível validar sua sessão</h1>
        <Button onClick={() => void router.invalidate()}>Tentar novamente</Button>
      </section>
    )
  },
})

const integrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/integracao',
  beforeLoad: requireDemo,
  component: lazyRouteComponent(() => import('./integration-status'), 'IntegrationStatus'),
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute, nftRoute, openSeaRoute, openSeaDetailRoute,
    cartRoute, loginRoute, registerRoute, checkoutRoute, integrationRoute,
  ]),
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
