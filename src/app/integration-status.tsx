import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ServiceStatus } from '@/contracts/service-status'
import { clearGuestCart } from '@/features/cart/guest-cart'
import { api } from '@/lib/api'
import { setSessionToken } from '@/lib/session-token'
import { CatalogProbe } from './catalog-probe'

// Load Socket.IO after MSW has installed the browser's WebSocket interceptor.
const RealtimeProbe = lazy(() => import('./realtime-probe'))

export function IntegrationStatus() {
  const [probeGeneration, setProbeGeneration] = useState(0)
  const status = useQuery({
    queryKey: ['service-status'],
    async queryFn({ signal }) {
      const { data } = await api.get<ServiceStatus>('/status', { signal })
      if (data.status !== 'ok') {
        throw new Error('Resposta inesperada da API')
      }
      return data
    },
    retry: false,
  })

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Estado da integração</h1>
      <p className="text-muted-foreground" role="status">
        {status.isFetching && 'Consultando a API…'}
        {!status.isFetching && status.isSuccess && 'API disponível.'}
      </p>
      {status.isError && !status.isFetching && (
        <p role="alert" className="text-destructive">A consulta à API falhou.</p>
      )}
      <Button disabled={status.isFetching} onClick={() => void status.refetch()}>
        Verificar novamente
      </Button>
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && (
        <>
          <CatalogProbe onReset={() => {
            clearGuestCart()
            setSessionToken(null)
            setProbeGeneration((value) => value + 1)
          }} />
          <Suspense fallback={<p>Carregando diagnóstico de tempo real…</p>}>
            <RealtimeProbe key={probeGeneration} />
          </Suspense>
        </>
      )}
    </section>
  )
}
