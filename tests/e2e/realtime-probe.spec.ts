import { expect, test } from '@playwright/test'

test('Socket.IO entrega eventos conforme a sessão e reinscreve após a queda', async ({ page }) => {
  await page.goto('/integracao')
  const publicEvents = page.getByTestId('public-event-count')
  const privateEvents = page.getByTestId('private-event-count')
  const receivedSession = page.getByTestId('private-session-id')
  const connection = page.getByTestId('probe-connection-id')

  await expect(publicEvents).toHaveText('1')
  await expect(privateEvents).toHaveText('0')

  const sessionResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/_demo/socket-session',
  )
  await page.getByRole('button', { name: 'Iniciar sessão de teste' }).click()
  const response = await sessionResponse
  expect(response.status()).toBe(201)
  expect(response.fromServiceWorker()).toBe(true)

  await expect(publicEvents).toHaveText('1')
  await expect(privateEvents).toHaveText('1')
  const issuedSession = await page.getByTestId('issued-session-id').innerText()
  await expect(receivedSession).toHaveText(issuedSession)
  const firstConnection = await connection.innerText()
  expect(firstConnection).toMatch(/^[\da-f-]{36}$/)

  await page.getByRole('button', { name: 'Interromper conexão de teste' }).click()
  await expect(publicEvents).toHaveText('2')
  await expect(privateEvents).toHaveText('2')
  await expect(connection).not.toHaveText(firstConnection)
  await expect(receivedSession).toHaveText(issuedSession)

  await page.getByRole('button', { name: 'Voltar a visitante' }).click()
  await expect(publicEvents).toHaveText('1')
  await expect(privateEvents).toHaveText('0')
  await expect(receivedSession).toHaveText('—')
})

test('o heartbeat mantém o transporte Socket.IO conectado', async ({ page }) => {
  await page.clock.install()
  await page.goto('/integracao')
  const publicEvents = page.getByTestId('public-event-count')
  const connection = page.getByTestId('probe-connection-id')
  await expect(publicEvents).toHaveText('1')
  const firstConnection = await connection.innerText()

  await page.clock.runFor(31_000)

  await expect(page.getByText('Conectado.', { exact: true })).toBeVisible()
  await expect(publicEvents).toHaveText('1')
  await expect(connection).toHaveText(firstConnection)
})
