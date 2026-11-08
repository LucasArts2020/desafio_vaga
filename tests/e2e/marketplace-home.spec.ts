import { expect, test } from '@playwright/test'

test('destaques, coleção e busca global acionam o catálogo pela URL', async ({ page }) => {
  await page.goto('/')
  const slides = page.getByRole('region', { name: 'Coleções em destaque' })
  await expect(slides).toContainText('Órbita / 012')
  const next = slides.getByRole('button', { name: 'Próximo destaque' })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(slides).toContainText('Maré digital')
  await expect(slides.getByRole('button', { name: 'Destaque 2 de 3' })).toHaveAttribute('aria-pressed', 'true')
  await next.click()
  await expect(slides).toContainText('Territórios')
  await slides.getByRole('button', { name: 'Explorar coleção' }).click()

  const catalog = page.getByRole('list', { name: 'Obras do catálogo' })
  await expect(catalog.getByRole('listitem')).toHaveCount(3)
  await expect(catalog).toContainText('Duna — estudo 03')
  await expect(catalog).not.toContainText('Órbita / 012')
  expect(new URL(page.url()).searchParams.get('collection')).toBe('Territórios')

  const search = page.getByRole('search', { name: 'Busca global' })
  await search.getByRole('searchbox', { name: 'Buscar no Acervo' }).fill('Duna')
  await search.getByRole('button', { name: 'Buscar no catálogo' }).click()
  await expect(catalog.getByRole('listitem')).toHaveCount(1)
  await expect(page).toHaveURL(/q=Duna/)
  await page.reload()
  await expect(catalog.getByRole('listitem')).toHaveCount(1)
  await expect(search.getByRole('searchbox', { name: 'Buscar no Acervo' })).toHaveValue('Duna')

  await catalog.getByRole('link').first().click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('link', { name: 'Carrinho, 1 item' })).toBeVisible()
})

test('ranking usa dados do MSW, troca de período, ordenação e controle de colunas', async ({ page }) => {
  const rankingResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/collections/rankings',
  )
  await page.goto('/')
  const response = await rankingResponse
  expect(response.fromServiceWorker()).toBe(true)
  expect(await response.json()).toMatchObject({ source: 'demo', period: '24h' })
  await expect(page.getByText('Dados simulados')).toBeVisible()
  const ranking = page.getByRole('table', { name: 'Ranking de coleções simuladas' })
  const first = ranking.getByRole('row').nth(1)
  await expect(first).toContainText('Matéria instável')
  await page.getByRole('button', { name: '1h', exact: true }).click()
  await expect(first).toContainText('Sinais')

  const floor = ranking.getByRole('button', { name: 'Preço mínimo' })
  await floor.click()
  await expect(ranking.getByRole('columnheader', { name: 'Preço mínimo' })).toHaveAttribute('aria-sort', 'ascending')
  await floor.click()
  await expect(first).toContainText('Territórios')

  const columns = page.getByRole('button', { name: 'Colunas' })
  if (await columns.isVisible()) {
    await columns.click()
    await page.getByRole('menuitemcheckbox', { name: 'Volume', exact: true }).click()
    await expect(ranking.getByRole('columnheader', { name: 'Volume', exact: true })).toHaveCount(0)
  } else {
    await expect(ranking.getByRole('columnheader', { name: 'Proprietários' })).toHaveCount(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
