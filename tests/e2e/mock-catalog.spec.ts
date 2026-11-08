import { expect, test } from '@playwright/test'
import type { ApiError } from '../../src/contracts/api-error'
import type { CatalogPage, Nft } from '../../src/contracts/catalog'

test('catálogo passa pelo MSW, persiste o cenário após refresh e restaura a seed', async ({ page }) => {
  const firstPage = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/nfts' && url.searchParams.get('page') === '1'
  })
  await page.goto('/integracao')
  const response = await firstPage
  expect(response.fromServiceWorker()).toBe(true)
  expect(response.status()).toBe(200)
  const initialCatalog = await response.json() as CatalogPage
  const list = page.getByRole('list', { name: 'Obras de teste' })
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await expect(list).toContainText('Órbita / 012')

  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page.getByText('Página 2 · 9 obras')).toBeVisible()
  await expect(list).toContainText('Ruído / 004')
  await expect(list).not.toContainText('Órbita / 012')

  await page.getByRole('button', { name: 'Ativar cenário vazio' }).click()
  await expect(page.getByText('Cenário ativo · Vazio')).toBeVisible()
  await expect(page.getByText('Nenhuma obra encontrada.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Cenário ativo · Vazio')).toBeVisible()
  await expect(page.getByText('Nenhuma obra encontrada.')).toBeVisible()

  await page.getByRole('button', { name: 'Iniciar sessão de teste' }).click()
  await expect(page.getByTestId('private-event-count')).toHaveText('1')
  const reset = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/v1/_demo/reset')
  await page.getByRole('button', { name: 'Restaurar dados de teste' }).click()
  expect((await reset).fromServiceWorker()).toBe(true)
  await expect(page.getByText('Cenário ativo · Padrão')).toBeVisible()
  await expect(page.getByTestId('public-event-count')).toHaveText('1')
  await expect(page.getByTestId('private-event-count')).toHaveText('0')

  const restoredPage = page.waitForResponse((result) => {
    const url = new URL(result.url())
    return url.pathname === '/api/v1/nfts' && url.searchParams.get('page') === '1'
  })
  await page.reload()
  expect(await (await restoredPage).json()).toEqual(initialCatalog)
  await expect(page.getByText('Cenário ativo · Padrão')).toBeVisible()
})

test('contrato do catálogo combina filtros, ordena diferenças de um wei e valida erros', async ({ page }) => {
  await page.goto('/integracao')
  await expect(page.getByRole('list', { name: 'Obras de teste' })).toBeVisible()

  const result = await page.evaluate(async () => {
    const [catalog, nft, invalid, missing] = await Promise.all([
      fetch('/api/v1/nfts?q=sinais&category=generativa&network=polygon&sort=price-desc&minPrice=0.025'),
      fetch('/api/v1/nfts/orbita-012'),
      fetch('/api/v1/nfts?minPrice=1e3'),
      fetch('/api/v1/nfts/ausente'),
    ])
    return {
      catalog: await catalog.json() as CatalogPage,
      nft: await nft.json() as Nft,
      invalid: { status: invalid.status, body: await invalid.json() as ApiError },
      missing: { status: missing.status, body: await missing.json() as ApiError },
    }
  })

  expect(result.catalog.total).toBe(2)
  expect(result.catalog.items.map(({ priceEth }) => priceEth)).toEqual(['0.025000000000000001', '0.025'])
  expect(result.nft.editions.map(({ id }) => id)).toEqual(['standard', 'signed'])
  expect(result.invalid).toMatchObject({ status: 400, body: { code: 'INVALID_CATALOG_QUERY' } })
  expect(result.missing).toMatchObject({ status: 404, body: { code: 'NFT_NOT_FOUND' } })
})
