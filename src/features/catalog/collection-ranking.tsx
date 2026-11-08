import { useQuery } from '@tanstack/react-query'
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rankingPeriods, type CollectionRank, type CollectionRanking, type RankingPeriod } from '@/contracts/collection-ranking'
import { api, retryApiRead } from '@/lib/api'
import { displayEth, parseEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const periods: Record<RankingPeriod, string> = { '1h': '1h', '6h': '6h', '24h': '24h', '7d': '7 dias', '30d': '30 dias' }
const columnClass: Record<string, string> = {
  position: 'w-9',
  volumeEth: 'hidden md:table-cell',
  volumeChangeBps: 'hidden lg:table-cell',
  floorChangeBps: 'hidden md:table-cell',
  owners: 'hidden lg:table-cell',
  totalNfts: 'hidden md:table-cell',
}
const columnLabels: Record<string, string> = {
  volumeEth: 'Volume',
  volumeChangeBps: 'Var. volume',
  floorEth: 'Preço mínimo',
  floorChangeBps: 'Var. piso',
  owners: 'Proprietários',
  totalNfts: 'NFTs',
}
const emptyRows: CollectionRank[] = []
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' })

function Change({ basisPoints }: { basisPoints: number | null }) {
  if (basisPoints === null) return <span className="text-muted-foreground">—</span>
  const color = basisPoints > 0 ? 'text-success' : basisPoints < 0 ? 'text-destructive' : 'text-muted-foreground'
  return <span className={color}>{percent.format(basisPoints / 10_000)}</span>
}

function compareEth(left: string | null, right: string | null) {
  if (left === null) return right === null ? 0 : -1
  if (right === null) return 1
  const a = parseEth(left)
  const b = parseEth(right)
  return a === b ? 0 : a < b ? -1 : 1
}

export function CollectionRankingTable({ explore }: { explore: (collection: string) => void }) {
  const [period, setPeriod] = useState<RankingPeriod>('24h')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const ranking = useQuery({
    queryKey: ['catalog', 'ranking', period],
    queryFn: async ({ signal }) => (await api.get<CollectionRanking>('/collections/rankings', { params: { period }, signal })).data,
    staleTime: 30_000,
    retry: retryApiRead,
  })
  const columns = useMemo<ColumnDef<CollectionRank>[]>(() => [
    { accessorKey: 'position', header: '#', enableHiding: false, enableSorting: false },
    {
      accessorKey: 'collection', header: 'Coleção', enableHiding: false,
      cell: ({ row }) => (
        <button type="button" className="flex min-h-11 min-w-0 items-center gap-2 rounded-sm text-left font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => explore(row.original.collection)}>
          <Avatar size="sm">
            {row.original.cover && <AvatarImage src={row.original.cover.url} alt="" />}
            <AvatarFallback>{row.original.collection.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 whitespace-normal">{row.original.collection}</span>
        </button>
      ),
    },
    {
      accessorKey: 'volumeEth', header: 'Volume',
      cell: ({ row }) => displayEth(row.original.volumeEth),
      sortingFn: (a, b) => compareEth(a.original.volumeEth, b.original.volumeEth),
    },
    {
      accessorKey: 'volumeChangeBps', header: 'Var. volume',
      cell: ({ row }) => <Change basisPoints={row.original.volumeChangeBps} />,
    },
    {
      accessorKey: 'floorEth', header: 'Preço mínimo',
      cell: ({ row }) => row.original.floorEth === null ? '—' : displayEth(row.original.floorEth),
      sortingFn: (a, b) => compareEth(a.original.floorEth, b.original.floorEth),
    },
    {
      accessorKey: 'floorChangeBps', header: 'Var. piso',
      cell: ({ row }) => <Change basisPoints={row.original.floorChangeBps} />,
    },
    { accessorKey: 'owners', header: 'Proprietários' },
    { accessorKey: 'totalNfts', header: 'NFTs' },
  ], [explore])
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 owns the table instance.
  const table = useReactTable({
    data: ranking.data?.items ?? emptyRows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.collection,
  })

  return (
    <section id="colecoes" aria-labelledby="ranking-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="ranking-title" className="text-xl font-semibold sm:text-2xl">Ranking de coleções</h2>
          <Badge variant="secondary" className="text-muted-foreground">Dados simulados</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Período do ranking" className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
            {rankingPeriods.map((option) => (
              <Button key={option} size="sm" variant={period === option ? 'secondary' : 'ghost'}
                className="h-11 px-2.5 sm:h-7"
                aria-pressed={period === option} onClick={() => setPeriod(option)}>{periods[option]}</Button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden lg:inline-flex"><Columns3 aria-hidden="true" /> Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()}
                  onCheckedChange={(checked) => column.toggleVisibility(checked === true)}>
                  {columnLabels[column.id]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {ranking.isPending && <Skeleton className="h-44" role="status" aria-label="Carregando ranking" />}
      {ranking.isError && (
        <div className="space-y-2">
          <p role="alert">Não foi possível carregar o ranking.</p>
          <Button variant="outline" onClick={() => void ranking.refetch()}>Tentar carregar o ranking novamente</Button>
        </div>
      )}
      {ranking.data && (ranking.data.items.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table aria-label="Ranking de coleções simuladas" className="tabular-nums">
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="border-border">
                  {group.headers.map((header) => {
                    const sort = header.column.getIsSorted()
                    const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown
                    return (
                      <TableHead key={header.id} className={cn('px-2 text-muted-foreground md:px-3', columnClass[header.column.id])}
                        aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}>
                        {header.column.getCanSort() ? (
                          <button type="button" onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex min-h-11 items-center gap-1 rounded-sm text-xs font-semibold hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <Icon className="size-3" aria-hidden="true" />
                          </button>
                        ) : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-border">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn('px-2 py-1 text-xs md:px-3 md:text-sm', columnClass[cell.column.id])}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">Nenhuma coleção no cenário atual.</p>)}
    </section>
  )
}
