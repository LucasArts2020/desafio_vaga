import { expect, test } from '@playwright/test'
import type { GuestCartSession } from '../../src/contracts/cart'
import { createMockSeed } from '../../src/mocks/fixtures'

test('catálogo restaura página e filtros pelo endereço e pelo histórico', async ({ page }) => {
  await page.goto('/?page=-7&sort=invalido')
  await expect(page.getByText('9 obras · Página 1')).toBeVisible()
  const list = page.getByRole('list', { name: 'Obras do catálogo' })
  await expect(list).toContainText('Órbita / 012')

  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(list).toContainText('Ruído / 004')
  await page.reload()
  await expect(page.getByText('9 obras · Página 2')).toBeVisible()

  await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('generativa')
  await expect(page).toHaveURL(/[?&]category=generativa/)
  await expect(page).not.toHaveURL(/[?&]page=/)
  await page.getByLabel('Rede').selectOption('polygon')
  await page.getByLabel('Ordenar').selectOption('price-desc')
  await page.getByLabel('Buscar obras').fill('  Sinais  ')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page).toHaveURL(/[?&]q=Sinais/)
  await expect(list.getByRole('listitem').first()).toContainText('Pulso / 002')

  await page.goBack()
  await expect(page.getByLabel('Buscar obras')).toHaveValue('')
  await expect(page.getByLabel('Rede')).toHaveValue('polygon')
  await page.goForward()
  await expect(page.getByLabel('Buscar obras')).toHaveValue('Sinais')

  await page.getByLabel('Buscar obras').fill('sem resultado')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('Nenhuma obra encontrada.')).toBeVisible()
})

test('detalhe direto diferencia obra inexistente e edição esgotada', async ({ page }) => {
  await page.goto('/nfts/mapa-de-vento')
  await expect(page.getByRole('heading', { name: 'Mapa de vento' })).toBeVisible()
  await expect(page.getByText('Edição esgotada.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()

  await page.goto('/nfts/ausente')
  await expect(page.getByRole('heading', { name: 'Obra não encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
  await expect(page.getByRole('heading', { name: 'Explore o Acervo' })).toBeVisible()
})

test('carrinho de visitante conserva edição, quantidades e subtotal após refresh', async ({ page }) => {
  await page.goto('/nfts/orbita-012')
  await page.getByRole('combobox', { name: 'Edição', exact: true }).selectOption('signed')
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()

  const added = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/cart/items')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  expect((await added).fromServiceWorker()).toBe(true)
  await expect(page.getByText('Limite desta edição atingido no carrinho.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()

  const summary = page.getByRole('complementary', { name: 'Resumo do pedido' })
  await expect(summary).toContainText('0,48 ETH')
  await page.reload()
  await expect(page.getByLabel('Quantidade de Edição assinada')).toHaveText('2')
  await expect(summary).toContainText('0,48 ETH')
  await expect(page.getByRole('button', { name: /Aumentar Edição assinada/ })).toBeDisabled()

  await page.getByRole('button', { name: /Diminuir Edição assinada/ }).click()
  await expect(page.getByLabel('Quantidade de Edição assinada')).toHaveText('1')
  await expect(summary).toContainText('0,24 ETH')
  await page.getByRole('button', { name: /Remover Edição assinada/ }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('a API valida versões, credenciais e limites na gravação concorrente', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('list', { name: 'Obras do catálogo' })).toBeVisible()
  const result = await page.evaluate(async () => {
    const { token, cart } = await (await fetch('/api/v1/carts/guest', { method: 'POST' })).json() as GuestCartSession
    const headers = { 'Content-Type': 'application/json', 'X-Guest-Cart': token }
    const add = (quantity: number, expectedVersion: number) => fetch('/api/v1/cart/items', {
      method: 'POST',
      headers,
      body: JSON.stringify({ nftId: 'orbita-012', editionId: 'signed', quantity, expectedVersion }),
    })

    const replies = await Promise.all([add(2, cart.version), add(2, cart.version)])
    const excess = await add(1, cart.version + 1)
    const anonymous = await fetch('/api/v1/cart')
    const owner = await fetch('/api/v1/cart', { headers })
    return {
      concurrent: replies.map((response) => response.status).sort(),
      excess: excess.status,
      anonymous: anonymous.status,
      cart: await owner.json(),
    }
  })

  expect(result).toMatchObject({
    concurrent: [200, 409],
    excess: 409,
    anonymous: 404,
    cart: { items: [{ editionId: 'signed', quantity: 2 }], subtotalEth: '0.48' },
  })
})

test('base de T03 migra para o carrinho sem apagar o cenário salvo', async ({ page }) => {
  await page.goto('/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  const seed = createMockSeed()
  await page.evaluate(async (legacy) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('acervo-demo', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('marketplace').put(legacy, 'state')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })
  }, {
    scenario: 'empty',
    accounts: seed.accounts,
    nfts: seed.nfts.map((nft) => ({ ...nft, media: [] })),
  })

  await page.goto('/')
  await expect(page.getByText('Nenhuma obra encontrada.')).toBeVisible()
  await page.goto('/nfts/orbita-012')
  await expect(page.getByRole('img', { name: 'Anel metálico sobre pedestal escuro' })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
  await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toContainText('Órbita / 012')
})
