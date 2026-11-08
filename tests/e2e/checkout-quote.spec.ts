import { expect, test, type Page } from '@playwright/test'
import type { AuthResult } from '../../src/contracts/auth'
import type { Quote } from '../../src/contracts/quote'
import { createMockSeed } from '../../src/mocks/fixtures'

async function addArtwork(page: Page) {
  await page.goto('/nfts/orbita-012')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
}

async function openCheckout(page: Page) {
  await page.getByRole('link', { name: 'Continuar para pagamento' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('marina@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('AcervoDemo#01')
  await page.getByRole('main').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Resumo da cotação' })).toBeVisible()
}

async function changeEdition(page: Page, update: { priceEth?: string; availableQuantity?: number }) {
  const status = await page.evaluate(async (data) =>
    (await fetch('/api/v1/_demo/editions/orbita-012/standard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })).status, update)
  expect(status).toBe(204)
}

test('cupons válidos persistem após refresh e login, e a cotação varia por rede', async ({ page }) => {
  await addArtwork(page)
  const coupon = page.getByRole('textbox', { name: 'Cupom de desconto' })
  const apply = page.getByRole('button', { name: 'Aplicar cupom' })
  const total = page.getByTestId('quote-total')
  await expect(total).toHaveText('0,122 ETH')

  await coupon.fill('INEXISTENTE')
  await apply.click()
  await expect(page.getByText('Cupom inválido.')).toBeVisible()
  await expect(coupon).toHaveAttribute('aria-invalid', 'true')
  await coupon.fill('EXPIRADO')
  await apply.click()
  await expect(page.getByText('Este cupom expirou.')).toBeVisible()
  await expect(total).toHaveText('0,122 ETH')

  const quoteResponse = page.waitForResponse(async (response) => {
    if (new URL(response.url()).pathname !== '/api/v1/quotes' || !response.ok()) return false
    return (await response.json() as Quote).couponCode === 'ACERVO5'
  })
  await coupon.fill(' acervo5 ')
  await apply.click()
  const response = await quoteResponse
  expect(response.fromServiceWorker()).toBe(true)
  expect(await response.json()).toMatchObject({
    subtotalEth: '0.12', discountEth: '0.006', networkFeeEth: '0.002', totalEth: '0.116',
  })
  await page.reload()
  await expect(page.getByText('Cupom aplicado · ACERVO5')).toBeVisible()
  await expect(total).toHaveText('0,116 ETH')

  await openCheckout(page)
  await expect(page.getByText('Cupom · ACERVO5')).toBeVisible()
  await page.getByRole('combobox', { name: 'Rede de pagamento' }).selectOption('polygon')
  await expect(total).toHaveText('0,1145 ETH')
  await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await page.getByRole('button', { name: 'Remover cupom' }).click()
  await expect(page.getByText('Cupom aplicado · ACERVO5')).toHaveCount(0)
  await expect(total).toHaveText('0,122 ETH')
})

test('preço desatualizado exige novo aceite e uma edição esgotada bloqueia a revisão', async ({ page }) => {
  await addArtwork(page)
  await openCheckout(page)
  const total = page.getByTestId('quote-total')
  const confirm = page.getByRole('button', { name: 'Confirmar valores' })
  await expect(total).toHaveText('0,122 ETH')
  await changeEdition(page, { priceEth: '0.120000000000000001' })

  const rejected = page.waitForResponse((response) => response.url().endsWith('/review') && response.status() === 409)
  await confirm.click()
  expect(await (await rejected).json()).toMatchObject({ code: 'QUOTE_CHANGED' })
  await expect(page.getByText('A cotação mudou. Revise os valores atualizados.')).toBeVisible()
  await expect(total).toHaveText('0,122000000000000001 ETH')
  await expect(page.getByText('Valores revisados.')).toHaveCount(0)
  await confirm.click()
  await expect(page.getByText('Valores revisados.')).toBeVisible()

  await changeEdition(page, { availableQuantity: 0 })
  await page.getByRole('button', { name: 'Atualizar revisão' }).click()
  await expect(page.getByRole('list', { name: 'Pendências da cotação' })).toContainText('Quantidade indisponível para Órbita / 012')
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toContainText('1 × Órbita / 012')
  await expect(page.getByText('Valores revisados.')).toHaveCount(0)
  await expect(confirm).toBeDisabled()
})

test('a API rejeita revisão de outra conta e de cotação vencida', async ({ page }) => {
  await page.clock.install()
  await addArtwork(page)
  const quoted = page.waitForResponse((response) => response.url().endsWith('/api/v1/quotes')
    && response.ok() && !!response.request().headers().authorization)
  await openCheckout(page)
  const quote: Quote = await (await quoted).json()
  const wrongOwner = await page.evaluate(async (quoteId) => {
    const session = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'caio@example.test', password: 'AcervoDemo#02' }),
    })
    const { token }: AuthResult = await session.json()
    return (await fetch(`/api/v1/quotes/${quoteId}/review`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })).status
  }, quote.quoteId)
  expect(wrongOwner).toBe(404)

  await page.clock.fastForward(5 * 60_000 + 1000)
  const expired = await page.evaluate(async (quoteId) => {
    const token = sessionStorage.getItem('acervo.session')
    const response = await fetch(`/api/v1/quotes/${quoteId}/review`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    return { status: response.status, body: await response.json() }
  }, quote.quoteId)
  expect(expired).toMatchObject({ status: 409, body: { code: 'QUOTE_EXPIRED' } })
})

test('a migração mantém sessão e seleção autenticada da versão anterior', async ({ page }) => {
  await page.goto('/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  const { nfts, accounts } = createMockSeed()
  await page.evaluate(async (legacy) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('acervo-demo', 3)
      request.onupgradeneeded = () => request.result.createObjectStore('marketplace').put(legacy, 'state')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })
    sessionStorage.setItem('acervo.session', 'legacy-session')
  }, {
    nfts,
    accounts,
    scenario: 'default',
    guestCarts: {},
    guestClaims: {},
    accountCarts: { marina: { version: 2, items: [{ id: 'legacy-line', nftId: 'orbita-012', editionId: 'standard', quantity: 2 }] } },
    sessions: { 'legacy-session': { userId: 'marina', expiresAt: Date.now() + 60_000, merge: { moved: 0, omitted: 0 } } },
  })

  await page.goto('/checkout')
  await expect(page.getByText('Revise a seleção de Marina Alves.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toContainText('2 × Órbita / 012')
  await expect(page.getByTestId('quote-total')).toHaveText('0,242 ETH')
})
