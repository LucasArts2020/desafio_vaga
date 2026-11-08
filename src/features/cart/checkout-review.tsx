import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { NftNetwork } from '@/contracts/catalog'
import type { QuoteReview } from '@/contracts/quote'
import { useSession, useSessionToken } from '@/features/auth/session-query'
import { api, apiProblem } from '@/lib/api'
import { displayAmount, displayEth } from '@/lib/eth'
import { sessionHeaders, sessionToken } from '@/lib/session-token'
import { useCart } from './guest-cart'
import { useQuote } from './quote-query'
import { QuoteIssues, QuoteTotals } from './quote-totals'

export function CheckoutReview() {
  const token = useSessionToken()
  const session = useSession()
  const cart = useCart()
  const [selectedNetwork, setNetwork] = useState<NftNetwork>()
  const network = selectedNetwork ?? (cart.data?.items.some((item) => item.stablecoin) ? 'polygon' : 'ethereum')
  const quote = useQuote(token, true, cart.data?.items.length ? cart.data.version : undefined, network)
  const review = useMutation({
    mutationKey: ['private', token, 'quote-review'],
    async mutationFn(quoteId: string) {
      if (!token || sessionToken() !== token) throw new Error('A sessão mudou.')
      const { data } = await api.post<QuoteReview>(`/quotes/${encodeURIComponent(quoteId)}/review`, undefined, {
        headers: sessionHeaders(token),
      })
      return data
    },
    async onError(error) {
      const code = apiProblem(error)?.code
      if (code === 'QUOTE_CHANGED' || code === 'QUOTE_EXPIRED' || code === 'QUOTE_NOT_FOUND') {
        await refresh()
      }
    },
  })

  async function refresh() {
    const previous = cart.data?.version
    const latest = await cart.refetch()
    if (sessionToken() === token && latest.isSuccess && latest.data?.items.length && latest.data.version === previous) {
      await quote.refetch()
    }
  }

  if (!token || !session.data) return null

  const { user, merge } = session.data
  const current = quote.data
  const reviewed = current && review.data?.quoteId === current.quoteId
  const changed = current && review.data && review.data.quoteId !== current.quoteId
  const canReview = current && !current.issues.length && !reviewed && !quote.isError && !quote.isFetching && !cart.isFetching
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">02 · Pagamento</p>
      <h1 className="text-4xl font-semibold tracking-tight">Finalize sua coleção.</h1>
      <p className="text-muted-foreground">Revise a seleção de {user.name}.</p>
      {import.meta.env.VITE_ENABLE_MOCKS !== 'true' && <p className="text-sm text-primary">Checkout simulado · Valores observados ao adicionar.</p>}
      {merge.omitted > 0 && (
        <p role="status" className="rounded-md bg-secondary p-3">{merge.omitted} unidade(s) do carrinho de visitante excediam a disponibilidade e ficaram fora da seleção.</p>
      )}
      {merge.couponNotice && <p role="status" className="rounded-md bg-secondary p-3">{merge.couponNotice}</p>}
      {cart.isPending && <div className="skeleton h-40 rounded-md" aria-label="Carregando revisão" role="status" />}
      {cart.isError && <p role="alert">A revisão do carrinho não pôde ser carregada.</p>}
      {cart.data && !cart.data.items.length && <p>Seu carrinho está vazio.</p>}
      {!!cart.data?.items.length && (
        <>
          <label className="block text-sm">
            Rede de pagamento
            <select
              className="field"
              value={network}
              disabled={review.isPending}
              onChange={(event) => {
                setNetwork(event.target.value === 'polygon' ? 'polygon' : 'ethereum')
                review.reset()
              }}
            >
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
            </select>
          </label>
          {quote.isPending && <div className="skeleton h-40 rounded-md" aria-label="Calculando cotação" role="status" />}
          {quote.isError && <p role="alert">A cotação não pôde ser carregada.</p>}
          {current && (
            <aside className="space-y-4 rounded-lg border border-input/70 bg-secondary/30 p-5" aria-label="Resumo da cotação">
              <h2 className="text-lg font-semibold">Revise seus NFTs</h2>
              <ul aria-label="Itens da revisão" className="space-y-2">
                {current.lines.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2">
                    <span>{item.quantity} × {item.title} · {item.openSea ? 'Anúncio' : item.editionLabel}</span>
                    <span>{item.stablecoin ? displayAmount(item.stablecoin.subtotal, 'USDC.e') : displayEth(item.subtotalEth)}</span>
                  </li>
                ))}
              </ul>
              {current.couponCode && <p className="text-sm text-primary">Cupom · {current.couponCode}</p>}
              <QuoteTotals quote={current} />
              <QuoteIssues issues={current.issues} />
              <p className="text-xs text-muted-foreground">
                Válida até <time dateTime={current.expiresAt}>{new Date(current.expiresAt).toLocaleTimeString('pt-BR')}</time>
              </p>
              {changed && <p role="status">A cotação mudou. Revise os valores atualizados.</p>}
              {review.isError && (
                <p role="alert" className="text-destructive">{apiProblem(review.error)?.message ?? 'Não foi possível validar esta cotação.'}</p>
              )}
              {reviewed && !quote.isError && <p role="status" className="text-primary">Valores revisados.</p>}
              <Button disabled={!canReview || review.isPending} onClick={() => review.mutate(current.quoteId)}>
                {review.isPending ? 'Validando valores…' : 'Confirmar valores'}
              </Button>
            </aside>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/carrinho">Voltar ao carrinho</Link></Button>
        <Button variant="secondary" disabled={cart.isFetching || quote.isFetching || review.isPending} onClick={() => void refresh()}>Atualizar revisão</Button>
      </div>
    </section>
  )
}
