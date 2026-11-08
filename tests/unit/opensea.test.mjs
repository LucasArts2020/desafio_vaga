import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOpenSeaHandler } from '../../server/opensea.ts'

const slug = 'colecao-teste'
const contract = '0x1111111111111111111111111111111111111111'
const identifier = '9007199254740993001'
const secret = 'credencial-ficticia-somente-servidor'
const collection = { name: 'Coleção teste', contracts: [{ address: contract, chain: 'ethereum' }] }
const item = {
  collection: slug,
  contract,
  identifier,
  name: 'Uma obra',
  description: 'Texto do catálogo',
  image_url: 'https://i2c.seadn.io/example.png',
  opensea_url: `https://opensea.io/assets/ethereum/${contract}/${identifier}`,
}

function request(query = '', method = 'GET') {
  return new globalThis.Request(`http://localhost/api/opensea${query}`, { method })
}

test('envia a chave apenas ao upstream e mantém o cursor e o ID em strings', async () => {
  const calls = []
  const handle = createOpenSeaHandler({ apiKey: secret, collection: slug }, async (url, options) => {
    calls.push(url)
    assert.equal(url.origin, 'https://api.opensea.io')
    assert.equal(options.headers['X-API-KEY'], secret)
    assert.equal(options.redirect, 'error')
    if (url.pathname.endsWith(`/collections/${slug}`)) return globalThis.Response.json(collection)
    assert.equal(url.searchParams.get('next'), 'abc+def=')
    return globalThis.Response.json({ nfts: [item, { ...item, is_disabled: true }], next: 'page-3' })
  })

  const response = await handle(request('?cursor=abc%2Bdef%3D'))
  assert.equal(response.status, 200)
  const body = await response.text()
  assert(!body.includes(secret))
  assert.deepEqual(JSON.parse(body), {
    collection: { slug, name: collection.name, description: null, imageUrl: null, bannerUrl: null, openSeaUrl: `https://opensea.io/collection/${slug}`, totalNfts: null },
    items: [{ collection: slug, contract, identifier, chain: 'ethereum', name: item.name, description: item.description, imageUrl: item.image_url, openSeaUrl: item.opensea_url }],
    next: 'page-3',
  })
  assert.equal((await handle(request('?cursor=abc%2Bdef%3D'))).status, 200)
  assert.equal(calls.length, 2)
})

test('restringe detalhes aos contratos da coleção e descarta URLs inseguras', async () => {
  let detailCalls = 0
  const handle = createOpenSeaHandler({ apiKey: secret, collection: slug }, async (url) => {
    if (url.pathname.endsWith(`/collections/${slug}`)) return globalThis.Response.json(collection)
    if (url.pathname.endsWith('/best')) return new globalThis.Response(null, { status: 404 })
    detailCalls += 1
    return globalThis.Response.json({ nft: { ...item, image_url: 'javascript:void(0)', opensea_url: 'https://example.test/fora' } })
  })

  assert.equal((await handle(request('?contract=ruim&identifier=1'))).status, 400)
  assert.equal((await handle(request(`?contract=0x${'2'.repeat(40)}&identifier=${identifier}`))).status, 404)
  assert.equal(detailCalls, 0)
  const response = await handle(request(`?contract=${contract}&identifier=${identifier}`))
  assert.equal(response.status, 200)
  const detail = await response.json()
  assert.equal(detail.identifier, identifier)
  assert.equal(detail.imageUrl, null)
  assert.equal(detail.openSeaUrl, `https://opensea.io/collection/${slug}`)
  assert.equal(detail.listing, null)
})

test('mantém o preço por unidade e a moeda do anúncio, com precisão atômica', async () => {
  const handle = createOpenSeaHandler({ apiKey: secret }, async (url) => {
    if (url.pathname.endsWith(`/collections/${slug}`)) return globalThis.Response.json(collection)
    if (url.pathname.endsWith('/best')) return globalThis.Response.json({
      chain: 'ethereum', asset: { contract, identifier }, status: 'ACTIVE', remaining_quantity: 3,
      price_per_item: { currency: 'WETH', decimals: 18, value: '9007199254740993001' },
    })
    return globalThis.Response.json({ nft: item })
  })
  const response = await handle(request(`?collection=${slug}&contract=${contract}&identifier=${identifier}`))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).listing, { price: { currency: 'WETH', amount: '9.007199254740993001' }, quantity: 3 })
})

test('junta anúncios ativos a metadados em lote e mantém apenas uma descrição breve', async () => {
  const listing = {
    chain: 'ethereum', asset: { contract, identifier }, status: 'ACTIVE', remaining_quantity: 1,
    price_per_item: { currency: 'ETH', decimals: 18, value: '9007199254740993001' },
  }
  const handle = createOpenSeaHandler({ apiKey: secret, collection: slug }, async (url, options) => {
    if (url.pathname.endsWith(`/collections/${slug}`)) return globalThis.Response.json(collection)
    if (url.pathname.endsWith('/best')) {
      assert.equal(url.searchParams.get('next'), 'incoming')
      return globalThis.Response.json({ listings: [listing, listing], next: 'outgoing' })
    }
    assert.equal(url.pathname, '/api/v2/nfts/batch')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { identifiers: [{ chain: 'ethereum', contract_address: contract, token_id: identifier }] })
    return globalThis.Response.json({ nfts: [{ ...item, description: 'Uma descrição que deve caber no card. '.repeat(10) }] })
  })
  const response = await handle(request('?listed=1&cursor=incoming'))
  assert.equal(response.status, 200)
  const page = await response.json()
  assert.equal(page.next, 'outgoing')
  assert.equal(page.items.length, 1)
  assert.deepEqual(page.items[0].price, { currency: 'ETH', amount: '9.007199254740993001' })
  assert(page.items[0].description.length <= 140)
  assert(page.items[0].description.endsWith('…'))
})

test('compõe o catálogo geral de várias coleções e usa o cursor das coleções', async () => {
  const other = 'outra-colecao'
  const handle = createOpenSeaHandler({ apiKey: secret, collection: slug }, async (url) => {
    if (url.pathname.endsWith('/top')) {
      assert.equal(url.searchParams.get('cursor'), 'cursor-geral')
      return globalThis.Response.json({ collections: [{ ...collection, collection: slug }, { ...collection, name: 'Outra', collection: other }], next: 'proximo' })
    }
    assert.equal(url.searchParams.get('next'), null)
    assert.equal(url.searchParams.get('limit'), '3')
    const selected = url.pathname.split('/').at(-2)
    return globalThis.Response.json({ nfts: [{ ...item, collection: selected }], next: 'cursor-de-nft' })
  })
  const response = await handle(request('?scope=general&cursor=cursor-geral'))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.collection, null)
  assert.equal(result.next, 'proximo')
  assert.deepEqual(result.items.map(({ collection, collectionName }) => [collection, collectionName]), [[slug, 'Coleção teste'], [other, 'Outra']])
})

test('consulta ranking e busca no upstream com períodos e filtros explícitos', async () => {
  const top = Array.from({ length: 10 }, (_, index) => ({ ...collection, collection: `${slug}-${index}` }))
  const handle = createOpenSeaHandler({ apiKey: secret }, async (url) => {
    if (url.pathname.endsWith('/top')) {
      assert.equal(url.searchParams.get('sort_by'), 'seven_days_volume')
      assert.equal(url.searchParams.get('limit'), '10')
      return globalThis.Response.json({ collections: top })
    }
    if (url.pathname.endsWith(`${slug}-9/stats`)) return new globalThis.Response(null, { status: 429 })
    if (url.pathname.endsWith('/stats')) return globalThis.Response.json({
      total: { floor_price: 12, floor_price_symbol: 'USDC', num_owners: 8 },
      intervals: [{ interval: 'seven_day', volume: 3.25, volume_symbol: 'ETH', sales: 4 }],
    })
    assert.equal(url.pathname, '/api/v2/search')
    assert.equal(url.searchParams.get('query'), 'arte & desenho')
    assert.deepEqual(url.searchParams.getAll('asset_types'), ['collection', 'nft'])
    return globalThis.Response.json({ results: [{ type: 'nft', nft: item }, { type: 'nft', nft: { ...item, is_nsfw: true } }] })
  })
  const result = await handle(request('?period=7d'))
  assert.equal(result.status, 200)
  const { items: rankedItems } = await result.json()
  assert.deepEqual(rankedItems.map(({ slug }) => slug), top.map(({ collection }) => collection))
  const [ranked] = rankedItems
  assert.deepEqual(ranked.volume, { amount: '3.25', currency: 'ETH' })
  assert.deepEqual(ranked.floor, { amount: '12', currency: 'USDC' })
  assert.equal(ranked.owners, 8)
  assert.equal(ranked.sales, 4)
  assert.equal(rankedItems.at(-1).sales, null)
  const search = await handle(request('?q=arte%20%26%20desenho'))
  const { items } = await search.json()
  assert.equal(items.length, 1)
  assert.equal(items[0].nft.identifier, identifier)
  assert.equal((await handle(request('?period=6h'))).status, 400)
  assert.equal((await handle(request(`?q=arte&collection=${slug}`))).status, 400)
})

test('preserva erros controlados de configuração, método e cota do upstream', async () => {
  const disabled = createOpenSeaHandler({}, () => assert.fail('A configuração sem chave não acessa a rede.'))
  assert.equal((await disabled(request())).status, 503)
  const method = await disabled(request('', 'POST'))
  assert.equal(method.status, 405)
  assert.equal(method.headers.get('Allow'), 'GET')

  const limited = createOpenSeaHandler({ apiKey: secret }, async () =>
    new globalThis.Response(secret, { status: 429, headers: { 'Retry-After': '8' } }),
  )
  const response = await limited(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '8')
  const body = await response.json()
  assert.equal(body.code, 'OPENSEA_RATE_LIMIT')
  assert(!JSON.stringify(body).includes(secret))
})
