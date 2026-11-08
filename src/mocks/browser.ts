import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import type { ServiceStatus } from '@/contracts/service-status'
import { apiBasePath } from '@/lib/api'
import { apiError } from './api-error'
import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { cartHandlers } from './cart'
import { collectionRankingHandler } from './collection-ranking'
import { demoHandlers } from './demo'
import { quoteHandlers } from './quotes'
import { probeSessionHandler, realtimeHandler } from './realtime'

const worker = setupWorker(
  ...(import.meta.env.VITE_ENABLE_MOCKS === 'true' ? [
    http.get(`${apiBasePath}/status`, () => HttpResponse.json<ServiceStatus>({ status: 'ok' })),
    probeSessionHandler,
    realtimeHandler,
    ...catalogHandlers,
    collectionRankingHandler,
    ...demoHandlers,
  ] : []),
  ...authHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  http.all(`${apiBasePath}/*`, () =>
    apiError(501, 'MOCK_HANDLER_MISSING', 'Operação ainda não implementada no mock.'),
  ),
)

export async function startMocks() {
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  })
}
