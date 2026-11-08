import { defineConfig, devices } from '@playwright/test'

const externalUrl = process.env.PLAYWRIGHT_BASE_URL
const localUrl = 'http://127.0.0.1:4173'
const localServer = process.env.PLAYWRIGHT_SERVER === 'preview' ? 'preview:demo' : 'dev:demo'

export default defineConfig({
  testDir: './tests/e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalUrl || localUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: externalUrl ? undefined : {
    command: `npm run ${localServer} -- --host 127.0.0.1 --port 4173 --strictPort`,
    url: localUrl,
  },
})
