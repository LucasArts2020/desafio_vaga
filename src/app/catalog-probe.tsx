import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CatalogPage } from '@/contracts/catalog'
import { demoResetPath, demoScenarioPath, type DemoState } from '@/contracts/demo'
import { api } from '@/lib/api'

const scenarioKey = ['demo-scenario'] as const
const catalogKey = ['catalog'] as const

export function CatalogProbe({ onReset }: { onReset: () => void }) {
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const scenario = useQuery({
    queryKey: scenarioKey,
    queryFn: async ({ signal }) => (await api.get<DemoState>(demoScenarioPath, { signal })).data,
  })
  const catalog = useQuery({
    queryKey: [...catalogKey, { page }],
    queryFn: async ({ signal }) => (await api.get<CatalogPage>('/nfts', { params: { page }, signal })).data,
  })
  const change = useMutation({
    async mutationFn(action: DemoState['scenario'] | 'reset') {
      const response = action === 'reset'
        ? await api.post<DemoState>(demoResetPath)
        : await api.put<DemoState>(demoScenarioPath, { scenario: action })
      return response.data
    },
    async onSuccess(state, action) {
      setPage(1)
      client.setQueryData(scenarioKey, state)
      if (action === 'reset') onReset()
      await client.invalidateQueries({ queryKey: catalogKey })
    },
  })
  const data = catalog.data

  return (
    <section aria-labelledby="catalog-probe-title" className="space-y-4 border-t border-input pt-6">
      <h2 id="catalog-probe-title" className="text-xl font-semibold">Catálogo de teste</h2>
      {scenario.data && (
        <p aria-live="polite">
          Cenário ativo · {scenario.data.scenario === 'default' ? 'Padrão' : 'Vazio'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={change.isPending} onClick={() => change.mutate('empty')}>
          Ativar cenário vazio
        </Button>
        <Button variant="secondary" disabled={change.isPending} onClick={() => change.mutate('reset')}>
          Restaurar dados de teste
        </Button>
      </div>
      {change.isError && <p role="alert">A alteração do cenário falhou.</p>}
      {(scenario.isError || catalog.isError) && <p role="alert">A consulta ao catálogo de teste falhou.</p>}
      {catalog.isPending && <p aria-live="polite">Carregando catálogo…</p>}
      {data && (
        <>
          <p aria-live="polite">Página {data.page} · {data.total} obras</p>
          {data.items.length > 0 ? (
            <ul aria-label="Obras de teste" className="space-y-1 text-muted-foreground">
              {data.items.map((item) => <li key={item.id}>{item.title} · {item.priceEth} ETH</li>)}
            </ul>
          ) : <p>Nenhuma obra encontrada.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={page === 1 || change.isPending} onClick={() => setPage(page - 1)}>
              Página anterior
            </Button>
            <Button
              variant="outline"
              disabled={data.page * data.pageSize >= data.total || change.isPending}
              onClick={() => setPage(page + 1)}
            >
              Próxima página
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
