import { http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import { demoResetPath, demoScenarioPath, type DemoState } from '@/contracts/demo'
import { apiBasePath } from '@/lib/api'
import { formatEth, parseEth } from '@/lib/eth'
import { apiError, MockFailure, respondToMock } from './api-error'
import { getEdition } from './cart'
import { resetRealtimeProbe } from './realtime'
import { readMockState, resetMockState, updateMockState } from './repository'

export const demoHandlers = [
  http.get(`${apiBasePath}${demoScenarioPath}`, async () => {
    const { scenario } = await readMockState()
    return HttpResponse.json<DemoState>({ scenario })
  }),
  http.put<PathParams, DefaultBodyType, DemoState | ApiError>(`${apiBasePath}${demoScenarioPath}`, async ({ request }) => {
    const body: unknown = await request.json().catch(() => null)
    const scenario = typeof body === 'object' && body !== null && 'scenario' in body
      ? body.scenario
      : undefined
    if (scenario !== 'default' && scenario !== 'empty') {
      return apiError(422, 'INVALID_DEMO_SCENARIO', 'Cenário desconhecido.')
    }

    await updateMockState((state) => { state.scenario = scenario })
    return HttpResponse.json<DemoState>({ scenario })
  }),
  http.post(`${apiBasePath}${demoResetPath}`, async () => {
    const { scenario } = await resetMockState()
    resetRealtimeProbe()
    return HttpResponse.json<DemoState>({ scenario })
  }),
  http.patch<{ nftId: string; editionId: string }, DefaultBodyType, ApiError | null>(
    `${apiBasePath}/_demo/editions/:nftId/:editionId`,
    ({ params, request }) => respondToMock(async () => {
      const body: unknown = await request.json().catch(() => null)
      const price = body && typeof body === 'object' && 'priceEth' in body ? body.priceEth : undefined
      const quantity = body && typeof body === 'object' && 'availableQuantity' in body ? body.availableQuantity : undefined
      let priceEth: string | undefined
      try {
        if (price !== undefined) {
          if (typeof price !== 'string') throw new RangeError()
          priceEth = formatEth(parseEth(price))
        }
      } catch (error) {
        if (!(error instanceof RangeError)) throw error
        throw new MockFailure(422, 'INVALID_PRICE', 'Informe um preço decimal em ETH.')
      }
      if ((quantity !== undefined && (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0))
        || (priceEth === undefined && quantity === undefined)) {
        throw new MockFailure(422, 'INVALID_EDITION_CHANGE', 'Informe um preço ou uma quantidade inteira não negativa.')
      }
      await updateMockState((state) => {
        const { nft, edition } = getEdition(state, params.nftId, params.editionId)
        const previousPrice = edition.priceEth
        const previousQuantity = edition.availableQuantity
        if (priceEth !== undefined) edition.priceEth = priceEth
        if (typeof quantity === 'number') edition.availableQuantity = quantity
        if (edition.priceEth !== previousPrice || edition.availableQuantity !== previousQuantity) nft.version += 1
      })
      return new HttpResponse<null>(null, { status: 204 })
    }),
  ),
]
