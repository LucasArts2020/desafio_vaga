import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { createOpenSeaHandler } from './server/opensea.ts'
import { openSeaPath } from './src/contracts/opensea.ts'

function openSeaProxy(apiKey?: string, collection?: string): Plugin {
  const handle = createOpenSeaHandler({ apiKey, collection })
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== openSeaPath) return next()
    void handle(new Request(url, { method: request.method })).then(async (result) => {
      response.writeHead(result.status, Object.fromEntries(result.headers))
      response.end(Buffer.from(await result.arrayBuffer()))
    }).catch(next)
  }

  return {
    name: 'acervo-opensea-proxy',
    configureServer: (server) => { server.middlewares.use(middleware) },
    configurePreviewServer: (server) => { server.middlewares.use(middleware) },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'OPENSEA_')
  return {
    plugins: [react(), tailwindcss(), openSeaProxy(env.OPENSEA_API_KEY, env.OPENSEA_COLLECTION)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
