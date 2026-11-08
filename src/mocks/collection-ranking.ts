import { http, HttpResponse, type PathParams } from 'msw'
import type { ApiError } from '@/contracts/api-error'
import { rankingPeriods, type CollectionRank, type CollectionRanking, type RankingPeriod } from '@/contracts/collection-ranking'
import { apiBasePath } from '@/lib/api'
import { parseEth } from '@/lib/eth'
import { apiError } from './api-error'
import { readMockState } from './repository'

type TradingActivity = readonly [volumeEth: string, volumeChangeBps: number, floorChangeBps: number]

const demoActivity: Record<string, { owners: number; periods: Record<RankingPeriod, TradingActivity> }> = {
  'Matéria instável': {
    owners: 2,
    periods: { '1h': ['0.46', 240, -120], '6h': ['1.38', -120, 250], '24h': ['4.8', 1240, 620], '7d': ['16.2', 1890, 410], '30d': ['64.4', 2310, 1140] },
  },
  'Territórios': {
    owners: 3,
    periods: { '1h': ['0.22', -340, 90], '6h': ['1.12', 450, -140], '24h': ['3.15', -520, 230], '7d': ['15.6', 360, -310], '30d': ['41.9', -870, -690] },
  },
  'Sinais': {
    owners: 4,
    periods: { '1h': ['0.72', 850, 110], '6h': ['1.46', 1240, 80], '24h': ['2.76', 815, -180], '7d': ['11.4', -640, 120], '30d': ['32.6', 940, 350] },
  },
}

export const collectionRankingHandler = http.get<PathParams, never, CollectionRanking | ApiError>(
  `${apiBasePath}/collections/rankings`,
  async ({ request }) => {
    const value = new URL(request.url).searchParams.get('period') ?? '24h'
    const period = rankingPeriods.find((item) => item === value)
    if (!period) return apiError(400, 'INVALID_RANKING_PERIOD', 'Selecione um período disponível.')

    const state = await readMockState()
    const nfts = state.scenario === 'empty' ? [] : state.nfts
    const items: Omit<CollectionRank, 'position'>[] = []
    for (const [collection, activity] of Object.entries(demoActivity)) {
      const artworks = nfts.filter((nft) => nft.collection === collection)
      if (!artworks.length) continue

      const floorEth = artworks.flatMap((nft) => nft.editions)
        .filter((edition) => edition.availableQuantity > 0)
        .reduce<string | null>((lowest, edition) => lowest === null || parseEth(edition.priceEth) < parseEth(lowest)
          ? edition.priceEth
          : lowest, null)
      const [volumeEth, volumeChangeBps, floorChangeBps] = activity.periods[period]
      items.push({
        collection,
        cover: artworks.find((nft) => nft.media.length)?.media[0] ?? null,
        volumeEth,
        volumeChangeBps,
        floorEth,
        floorChangeBps: floorEth === null ? null : floorChangeBps,
        owners: activity.owners,
        totalNfts: artworks.length,
      })
    }

    items.sort((a, b) => {
      const left = parseEth(a.volumeEth)
      const right = parseEth(b.volumeEth)
      return left === right ? a.collection.localeCompare(b.collection) : left > right ? -1 : 1
    })
    return HttpResponse.json<CollectionRanking>({
      source: 'demo',
      period,
      items: items.map((item, index) => ({ ...item, position: index + 1 })),
    })
  },
)
