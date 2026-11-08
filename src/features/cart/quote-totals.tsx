import type { Quote, QuoteIssue } from '@/contracts/quote'
import { displayAmount, displayEth } from '@/lib/eth'

export function QuoteTotals({ quote }: { quote: Quote }) {
  const stablecoin = quote.stablecoin
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><dt>Subtotal</dt><dd>{stablecoin ? displayAmount(stablecoin.subtotal, 'USDC.e') : displayEth(quote.subtotalEth)}{stablecoin && quote.subtotalEth !== '0' && ` + ${displayEth(quote.subtotalEth)}`}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>Desconto</dt><dd>{stablecoin ? displayAmount(stablecoin.discount, 'USDC.e') : displayEth(quote.discountEth)}{stablecoin && quote.discountEth !== '0' && ` + ${displayEth(quote.discountEth)}`}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>Taxa de rede</dt><dd>{displayEth(quote.networkFeeEth)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-input/70 pt-2 font-semibold">
        <dt>Total</dt><dd data-testid="quote-total">{stablecoin && `${displayAmount(stablecoin.total, 'USDC.e')} + `}{displayEth(quote.totalEth)}</dd>
      </div>
    </dl>
  )
}

export function QuoteIssues({ issues }: { issues: QuoteIssue[] }) {
  if (issues.length === 0) return null

  return (
    <ul aria-label="Pendências da cotação" className="space-y-2 text-sm text-destructive" aria-live="polite">
      {issues.map((issue) => <li key={issue.lineId ?? issue.code}>{issue.message}</li>)}
    </ul>
  )
}
