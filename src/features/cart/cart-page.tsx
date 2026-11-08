import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { apiProblem } from '@/lib/api'
import { displayAmount, displayEth } from '@/lib/eth'
import { useCart, useCartMutation } from './guest-cart'
import { useQuote } from './quote-query'
import { QuoteIssues, QuoteTotals } from './quote-totals'

export function CartPage() {
  const cart = useCart()
  const change = useCartMutation()
  const data = cart.data
  const network = data?.items.some((item) => item.stablecoin) ? 'polygon' : 'ethereum'
  const quote = useQuote(cart.token, cart.isPrivate, data?.items.length ? data.version : undefined, network)
  const couponError = apiProblem(change.error)?.fieldErrors?.code
  const canContinue = quote.data && quote.data.issues.length === 0 && !quote.isError && !quote.isFetching && !change.isPending

  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const code = String(new FormData(event.currentTarget).get('coupon') ?? '')
    change.mutate({ type: 'apply-coupon', code, expectedVersion: data.version })
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">01 · Carrinho</p>
        <h1 className="text-4xl font-semibold tracking-tight">Seu próximo acervo.</h1>
        <p className="text-muted-foreground">Revise as obras e edições da sua seleção.</p>
        {import.meta.env.VITE_ENABLE_MOCKS !== 'true' && <p className="text-sm text-primary">Carrinho de demonstração · Valores observados ao adicionar.</p>}
      </div>

      {cart.token && cart.isPending && (
        <div aria-label="Carregando carrinho" role="status" className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="skeleton h-52 rounded-md" />
          <div className="skeleton h-40 rounded-md" />
        </div>
      )}
      {cart.isError && (
        <div className="space-y-3">
          <p role="alert">O carrinho não pôde ser carregado.</p>
          <Button onClick={() => void cart.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {change.isError && !couponError && (
        <p role="alert" className="text-destructive">{apiProblem(change.error)?.message ?? 'Não foi possível alterar o carrinho.'}</p>
      )}
      {change.isSuccess && <p role="status" className="sr-only">Carrinho atualizado.</p>}
      {(!cart.token || (data && data.items.length === 0)) && (
        <div className="space-y-4 rounded-md border border-input/70 p-6">
          <p>Seu carrinho está vazio.</p>
          <Button asChild><Link to="/">Explorar catálogo</Link></Button>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <ul aria-label="Itens do carrinho" className="divide-y divide-input/70 border-y border-input/70">
            {data.items.map((item) => (
              <li key={item.id} className="space-y-4 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  {item.cover && (
                    <img src={item.cover.url} alt={item.cover.alt} width={76} height={50} className="rounded-md" />
                  )}
                  <div className="min-w-0 flex-1">
                    {item.openSea ? (
                      <Link to="/opensea/$contract/$identifier" params={{ contract: item.openSea.contract, identifier: item.openSea.identifier }}
                        search={{ collection: item.openSea.collection }} className="font-semibold underline-offset-4 hover:underline">{item.title}</Link>
                    ) : import.meta.env.VITE_ENABLE_MOCKS === 'true' ? (
                      <Link to="/nfts/$nftId" params={{ nftId: item.nftId }} className="font-semibold underline-offset-4 hover:underline">{item.title}</Link>
                    ) : <span className="font-semibold">{item.title}</span>}
                    <p className="text-sm text-muted-foreground">{item.openSea ? 'Anúncio' : item.editionLabel} · {item.stablecoin ? displayAmount(item.stablecoin.price, 'USDC.e') : displayEth(item.priceEth)} por unidade</p>
                  </div>
                  <span className="font-medium">{item.stablecoin ? displayAmount(item.stablecoin.subtotal, 'USDC.e') : displayEth(item.subtotalEth)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" aria-label={`Diminuir ${item.editionLabel} de ${item.title}`}
                    disabled={change.isPending || item.quantity <= 1}
                    onClick={() => change.mutate({ type: 'update', lineId: item.id, quantity: item.quantity - 1, expectedVersion: data.version })}>−</Button>
                  <output aria-label={`Quantidade de ${item.editionLabel}`} className="min-w-6 text-center">{item.quantity}</output>
                  <Button variant="outline" size="icon" aria-label={`Aumentar ${item.editionLabel} de ${item.title}`}
                    disabled={change.isPending || item.quantity >= item.availableQuantity}
                    onClick={() => change.mutate({ type: 'update', lineId: item.id, quantity: item.quantity + 1, expectedVersion: data.version })}>+</Button>
                  <Button variant="ghost" disabled={change.isPending}
                    aria-label={`Remover ${item.editionLabel} de ${item.title}`}
                    onClick={() => change.mutate({ type: 'remove', lineId: item.id, expectedVersion: data.version })}>Remover</Button>
                </div>
              </li>
            ))}
            </ul>
            <div className="space-y-3 rounded-md border border-input/70 p-4">
              <form onSubmit={applyCoupon} className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 text-sm">
                  Cupom de desconto
                  <input key={data.couponCode ?? 'none'} name="coupon" defaultValue={data.couponCode ?? ''} required maxLength={40}
                    className="field uppercase" aria-invalid={!!couponError} aria-describedby={couponError ? 'coupon-error' : undefined} />
                </label>
                <Button type="submit" variant="outline" disabled={change.isPending}>Aplicar cupom</Button>
              </form>
              {couponError && <p id="coupon-error" role="alert" className="text-sm text-destructive">{couponError}</p>}
              {data.couponCode && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-primary" role="status">Cupom aplicado · {data.couponCode}</p>
                  <Button variant="ghost" size="sm" disabled={change.isPending}
                    onClick={() => change.mutate({ type: 'remove-coupon', expectedVersion: data.version })}>Remover cupom</Button>
                </div>
              )}
            </div>
          </div>
          <aside className="space-y-4 rounded-lg border border-input/70 bg-secondary/30 p-5" aria-label="Resumo do pedido">
            <h2 className="text-lg font-semibold">Resumo do pedido</h2>
            <p className="text-sm text-muted-foreground">Estimativa na rede {network === 'polygon' ? 'Polygon' : 'Ethereum'}</p>
            {quote.isPending && <div className="skeleton h-24 rounded-md" role="status" aria-label="Calculando total" />}
            {quote.isError && (
              <>
                <p role="alert" className="text-sm text-destructive">Não foi possível cotar esta seleção.</p>
                <Button variant="outline" onClick={() => void quote.refetch()}>Tentar cotar novamente</Button>
              </>
            )}
            {quote.data && <><QuoteTotals quote={quote.data} /><QuoteIssues issues={quote.data.issues} /></>}
            {canContinue ? (
              <Button asChild className="w-full"><Link to="/checkout">Continuar para pagamento</Link></Button>
            ) : (
              <Button disabled className="w-full">Continuar para pagamento</Button>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
