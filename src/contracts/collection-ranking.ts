import type { NftMedia } from './catalog'
import type { EthDecimal } from '@/lib/eth'

export const rankingPeriods = ['1h', '6h', '24h', '7d', '30d'] as const
export type RankingPeriod = typeof rankingPeriods[number]

export interface CollectionRank {
  position: number
  collection: string
  cover: NftMedia | null
  volumeEth: EthDecimal
  volumeChangeBps: number
  floorEth: EthDecimal | null
  floorChangeBps: number | null
  owners: number
  totalNfts: number
}

export interface CollectionRanking {
  source: 'demo'
  period: RankingPeriod
  items: CollectionRank[]
}
