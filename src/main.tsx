import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { subscribeSession } from '@/lib/session-token'
import { queryClient } from '@/app/query-client'
import { router } from '@/app/router'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemento raiz ausente')
}

const root = createRoot(container)
subscribeSession((previous, next) => {
  if (previous) {
    const key = ['private', previous]
    void queryClient.cancelQueries({ queryKey: key })
    queryClient.removeQueries({ queryKey: key })
    const mutations = queryClient.getMutationCache()
    mutations.findAll({ mutationKey: key }).forEach((mutation) => mutations.remove(mutation))
    if (!next) void router.invalidate()
  }
})

async function bootstrap() {
  const { startMocks } = await import('@/mocks/browser')
  await startMocks()

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap().catch((error: unknown) => {
  console.error(error)
  root.render(
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-12">
      <h1 className="text-3xl font-semibold">Falha na inicialização</h1>
      <p role="alert">Recarregue a página para tentar novamente.</p>
    </main>,
  )
})
