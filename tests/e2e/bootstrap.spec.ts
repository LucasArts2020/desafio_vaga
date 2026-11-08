import { expect, test } from '@playwright/test'

test('a rota direta consulta a API após iniciar o MSW', async ({ page }) => {
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/status',
  )
  await page.goto('/integracao')
  const response = await responsePromise

  expect(response.status()).toBe(200)
  expect(response.fromServiceWorker()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Estado da integração' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('API disponível.')

  await page.reload()
  await expect(page.getByRole('status')).toHaveText('API disponível.')

  const retryResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/status',
  )
  await page.getByRole('button', { name: 'Verificar novamente' }).click()
  expect((await retryResponse).fromServiceWorker()).toBe(true)
  await expect(page.getByRole('status')).toHaveText('API disponível.')
})

test('rota inexistente permite voltar ao início e navegar pelo Router', async ({ page }) => {
  await page.goto('/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page.getByRole('heading', { name: 'Explore o Acervo' })).toBeVisible()
  await page.getByRole('link', { name: 'Verificar integração' }).click()
  await expect(page).toHaveURL(/\/integracao$/)
  await expect(page.getByRole('status')).toHaveText('API disponível.')
})
