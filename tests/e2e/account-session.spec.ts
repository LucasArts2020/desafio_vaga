import { expect, test, type Page } from '@playwright/test'
import type { AuthResult } from '../../src/contracts/auth'
import type { Cart } from '../../src/contracts/cart'
import { createMockSeed } from '../../src/mocks/fixtures'

async function enter(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('main').getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('login volta ao checkout e reaplicar o mesmo carrinho não duplica itens', async ({ page }) => {
  await page.goto('/nfts/orbita-012')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
  const guestToken = await page.evaluate(() => sessionStorage.getItem('acervo.guest-cart')!)
  await page.getByRole('link', { name: 'Continuar para pagamento' }).click()
  await expect(page).toHaveURL(/\/login\?returnTo=/)

  await enter(page, 'marina@example.test', 'senha-incorreta')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  const login = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/auth/login' && response.ok(),
  )
  await enter(page, 'marina@example.test', 'AcervoDemo#01')
  expect((await login).fromServiceWorker()).toBe(true)
  await expect(page).toHaveURL(/\/checkout$/)
  const items = page.getByRole('list', { name: 'Itens da revisão' })
  await expect(items).toContainText('1 × Órbita / 012')
  await page.reload()
  await expect(items).toContainText('1 × Órbita / 012')

  const result = await page.evaluate(async (guest) => {
    const login = (email: string, password: string) => fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Cart': guest },
      body: JSON.stringify({ email, password }),
    })
    const replay = await login('marina@example.test', 'AcervoDemo#01')
    const session: AuthResult = await replay.json()
    const cart: Cart = await (await fetch('/api/v1/cart', { headers: { Authorization: `Bearer ${session.token}` } })).json()
    const other = await login('caio@example.test', 'AcervoDemo#02')
    return { replay: replay.status, moved: session.merge.moved, quantities: cart.items.map(({ quantity }) => quantity), other: other.status }
  }, guestToken)
  expect(result).toEqual({ replay: 200, moved: 1, quantities: [1], other: 403 })
})

test('expiração durante a revisão preserva retorno e logout isola a outra conta', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Entre no seu Acervo.' })).toBeVisible()
  await enter(page, 'marina@example.test', 'AcervoDemo#01')
  await expect(page).toHaveURL(/\/checkout$/)
  await page.goto('/nfts/mare-digital')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
  await page.getByRole('link', { name: 'Continuar para pagamento' }).click()
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toContainText('Maré digital')

  const expired = await page.evaluate(async () => {
    const token = sessionStorage.getItem('acervo.session')
    const response = await fetch('/api/v1/_demo/session/expire', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.status
  })
  expect(expired).toBe(204)
  await page.reload()
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toHaveCount(0)
  await enter(page, 'marina@example.test', 'AcervoDemo#01')
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toContainText('Maré digital')

  const oldToken = await page.evaluate(() => sessionStorage.getItem('acervo.session')!)
  const logout = page.waitForResponse((response) => response.request().method() === 'DELETE'
    && new URL(response.url()).pathname === '/api/v1/session')
  await page.getByRole('button', { name: 'Menu da conta de Marina Alves' }).click()
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click()
  expect((await logout).status()).toBe(204)
  await expect(page.getByRole('heading', { name: 'Entre no seu Acervo.' })).toBeVisible()
  await enter(page, 'caio@example.test', 'AcervoDemo#02')
  await expect(page.getByText('Revise a seleção de Caio Costa.')).toBeVisible()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await expect(page.getByText('Maré digital')).toHaveCount(0)
  const revoked = await page.evaluate(async (token) =>
    (await fetch('/api/v1/cart', { headers: { Authorization: `Bearer ${token}` } })).status, oldToken)
  expect(revoked).toBe(401)
})

test('cadastro valida confirmação, informa conflito e mantém a conta após refresh', async ({ page }) => {
  await page.goto('/checkout')
  await page.getByRole('link', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill('Iara de Teste')
  await page.getByLabel('E-mail', { exact: true }).fill('MARINA@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('MinhaDemo#01')
  await page.getByLabel('Confirmar senha').fill('OutraDemo#01')
  await page.getByRole('checkbox', { name: 'Aceito os termos da demonstração.' }).check()
  const submit = page.getByRole('button', { name: 'Criar conta', exact: true })
  await submit.click()
  await expect(page.getByText('As senhas precisam coincidir.')).toBeVisible()
  await page.getByLabel('Confirmar senha').fill('MinhaDemo#01')
  await submit.click()
  await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible()
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel('E-mail', { exact: true }).fill('iara@example.test')
  await submit.click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByText('Revise a seleção de Iara de Teste.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Revise a seleção de Iara de Teste.')).toBeVisible()
})

test('login descarta um endereço externo como retorno', async ({ page }) => {
  await page.goto('/login?returnTo=%2F%2Fexample.test%2F')
  const origin = new URL(page.url()).origin
  await enter(page, 'caio@example.test', 'AcervoDemo#02')
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.getByRole('button', { name: 'Menu da conta de Caio Costa' })).toBeVisible()
})

test('migra carrinho de visitante existente e preserva a quantidade da conta no merge', async ({ page }) => {
  await page.goto('/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  const seed = createMockSeed()
  await page.evaluate(async (legacy) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('acervo-demo', 2)
      request.onupgradeneeded = () => request.result.createObjectStore('marketplace').put(legacy, 'state')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })
    sessionStorage.setItem('acervo.guest-cart', 'legacy-guest')
  }, {
    scenario: seed.scenario,
    accounts: seed.accounts,
    nfts: seed.nfts,
    guestCarts: {
      'legacy-guest': {
        version: 2,
        items: [{ id: 'legacy-line', nftId: 'orbita-012', editionId: 'signed', quantity: 2 }],
      },
    },
  })
  await page.goto('/carrinho')
  await expect(page.getByLabel('Quantidade de Edição assinada')).toHaveText('2')

  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marina@example.test', password: 'AcervoDemo#01' }),
    })
    const { token }: AuthResult = await response.json()
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const cart: Cart = await (await fetch('/api/v1/cart', { headers })).json()
    return (await fetch('/api/v1/cart/items', {
      method: 'POST',
      headers,
      body: JSON.stringify({ nftId: 'orbita-012', editionId: 'signed', quantity: 1, expectedVersion: cart.version }),
    })).status
  })
  expect(prepared).toBe(200)

  await page.getByRole('link', { name: 'Continuar para pagamento' }).click()
  await enter(page, 'marina@example.test', 'AcervoDemo#01')
  await expect(page.getByRole('list', { name: 'Itens da revisão' })).toContainText('2 × Órbita / 012')
  await expect(page.getByText(/1 unidade\(s\) do carrinho de visitante/)).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Resumo da cotação' })).toContainText('0,48 ETH')
})
