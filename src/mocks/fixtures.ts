import type { Nft } from '@/contracts/catalog'
import type { DemoState } from '@/contracts/demo'
import type { Account, CartMerge } from '@/contracts/auth'
import type { Quote } from '@/contracts/quote'
import type { CartItem } from '@/contracts/cart'
import type { OpenSeaNftRef } from '@/contracts/opensea'

export interface PasswordDigest {
  algorithm: 'PBKDF2-SHA-256'
  iterations: number
  saltHex: string
  digestHex: string
}

export interface MockAccount extends Account {
  password: PasswordDigest
}

export interface MockState extends DemoState {
  accounts: MockAccount[]
  nfts: Nft[]
  guestCarts: Record<string, StoredCart>
  accountCarts: Record<string, StoredCart>
  guestClaims: Record<string, { userId: string; merge: CartMerge }>
  sessions: Record<string, { userId: string; expiresAt: number; merge: CartMerge }>
  quotes: Record<string, StoredQuote>
}

export interface CartOwner {
  kind: 'account' | 'guest'
  id: string
}

export interface StoredQuote {
  owner: CartOwner
  quote: Quote
  signature: string
  reviewedAt?: string
}

export interface StoredCart {
  version: number
  items: StoredCartLine[]
  couponCode?: string
}

export interface StoredCartLine {
  id: string
  nftId: string
  editionId: string
  quantity: number
  external?: Pick<CartItem, 'title' | 'editionLabel' | 'cover' | 'availableQuantity' | 'priceEth'> & { openSea: OpenSeaNftRef; priceUsdc?: string }
}

export function defaultNftMedia(nftId: string): Nft['media'] {
  switch (nftId) {
    case 'orbita-012': return [{ url: '/art/orbita.svg', alt: 'Anel metálico sobre pedestal escuro' }]
    case 'mare-digital': return [{ url: '/art/mare.svg', alt: 'Onda azul luminosa sobre pedestal' }]
    case 'duna-03': return [{ url: '/art/duna.svg', alt: 'Esfera laranja suspensa sobre dunas' }]
    default: return []
  }
}

const accounts: MockAccount[] = [
  {
    id: 'marina',
    name: 'Marina Alves',
    email: 'marina@example.test',
    password: {
      algorithm: 'PBKDF2-SHA-256',
      iterations: 210_000,
      saltHex: '12e434bf1089efac840a261d9816d234',
      digestHex: '9933b132b3ed5fcc5ec84ed426cbdfa6106ad8c2d30dbccef566d30a4f928fe4',
    },
  },
  {
    id: 'caio',
    name: 'Caio Costa',
    email: 'caio@example.test',
    password: {
      algorithm: 'PBKDF2-SHA-256',
      iterations: 210_000,
      saltHex: '8e33a5674f5ef0e389062e00c99898de',
      digestHex: 'f499dea17a372e43402c9f4a1625afc2087fd6d53ca53362c363babb916bd332',
    },
  },
]

const nftRows = [
  ['orbita-012', 'Órbita / 012', 'Nara Nunes', 'Matéria instável', 'arte-3d', 'ethereum', '0.12', 8],
  ['mare-digital', 'Maré digital', 'Lu Costa', 'Matéria instável', 'arte-3d', 'ethereum', '0.08', 12],
  ['duna-03', 'Duna — estudo 03', 'Caio Luz', 'Territórios', 'arte-3d', 'ethereum', '0.095', 4],
  ['ruido-04', 'Ruído / 004', 'Nara Nunes', 'Sinais', 'generativa', 'polygon', '0.025', 7],
  ['janela-noturna', 'Janela noturna', 'Iara Neri', 'Territórios', 'fotografia', 'ethereum', '0.18', 2],
  ['pulso-02', 'Pulso / 002', 'Lu Costa', 'Sinais', 'generativa', 'polygon', '0.025000000000000001', 3],
  ['mapa-de-vento', 'Mapa de vento', 'Iara Neri', 'Territórios', 'ilustracao', 'polygon', '0.05', 0],
  ['luz-rasante', 'Luz rasante', 'Caio Luz', 'Sinais', 'fotografia', 'ethereum', '0.08', 5],
  ['linha-aberta', 'Linha aberta', 'Nara Nunes', 'Sinais', 'ilustracao', 'ethereum', '0.005', 20],
] as const satisfies readonly (readonly [
  string, string, string, string, Nft['category'], Nft['network'], string, number,
])[]

export function createMockSeed(): MockState {
  const nfts: Nft[] = nftRows.map(([id, title, artist, collection, category, network, priceEth, availableQuantity], index) => ({
    id,
    title,
    artist,
    collection,
    description: `Obra de ${artist} da coleção ${collection}.`,
    category,
    network,
    createdAt: new Date(Date.UTC(2026, 9, 28 - index)).toISOString(),
    featured: index < 3,
    version: 1,
    media: defaultNftMedia(id),
    editions: [{ id: 'standard', label: 'Edição padrão', priceEth, availableQuantity }],
  }))

  nfts[0].editions.push({ id: 'signed', label: 'Edição assinada', priceEth: '0.24', availableQuantity: 2 })

  return {
    scenario: 'default',
    accounts: structuredClone(accounts),
    nfts,
    guestCarts: {},
    accountCarts: {},
    guestClaims: {},
    sessions: {},
    quotes: {},
  }
}
