import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Nft } from '@/contracts/catalog'
import { useCart, useCartMutation } from '@/features/cart/guest-cart'
import { apiProblem } from '@/lib/api'
import { displayEth, formatEth, parseEth } from '@/lib/eth'
import { Artwork } from './artwork'
import { useNft } from './catalog-query'

function NftDetails({ nft }: { nft: Nft }) {
  const [editionId, setEditionId] = useState(nft.editions[0].id)
  const [quantity, setQuantity] = useState(1)
  const [mediaIndex, setMediaIndex] = useState(0)
  const cart = useCart()
  const add = useCartMutation()
  const edition = nft.editions.find((item) => item.id === editionId) ?? nft.editions[0]
  const inCart = cart.data?.items.find((item) => item.nftId === nft.id && item.editionId === edition.id)?.quantity ?? 0
  const remaining = Math.max(0, edition.availableQuantity - inCart)
  const selectedQuantity = Math.min(quantity, Math.max(remaining, 1))
  const subtotal = formatEth(parseEth(edition.priceEth) * BigInt(selectedQuantity))

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
      <div className="space-y-3">
        <Artwork media={nft.media[mediaIndex] ?? nft.media[0] ?? null} eager />
        {nft.media.length > 1 && (
          <div aria-label="Imagens da obra" className="flex flex-wrap gap-2">
            {nft.media.map((media, index) => (
              <Button
                key={media.url}
                variant="outline"
                aria-pressed={index === mediaIndex}
                onClick={() => setMediaIndex(index)}
              >
                Imagem {index + 1}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{nft.collection}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{nft.title}</h1>
        <p className="text-sm text-muted-foreground">Obra de {nft.artist}</p>
        <p>{nft.description}</p>
        <section aria-label="Compra da edição" className="space-y-4 rounded-lg border border-input/70 bg-secondary/30 p-5">
          <label className="block text-sm">
            Edição
            <select
              value={edition.id}
              className="field"
              onChange={(event) => {
                setEditionId(event.target.value)
                setQuantity(1)
                add.reset()
              }}
            >
              {nft.editions.map((item) => (
                <option value={item.id} key={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <p className="text-2xl font-semibold">{displayEth(edition.priceEth)}</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {edition.availableQuantity === 0 ? 'Edição esgotada.' : remaining === 0
              ? 'Limite desta edição atingido no carrinho.'
              : `${remaining} disponíveis para adicionar.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Quantidade</span>
            <Button variant="outline" size="icon" aria-label="Diminuir quantidade" disabled={selectedQuantity <= 1 || add.isPending}
              onClick={() => setQuantity(selectedQuantity - 1)}>−</Button>
            <output aria-label="Quantidade selecionada">{remaining === 0 ? 0 : selectedQuantity}</output>
            <Button variant="outline" size="icon" aria-label="Aumentar quantidade" disabled={selectedQuantity >= remaining || add.isPending}
              onClick={() => setQuantity(selectedQuantity + 1)}>+</Button>
          </div>
          {remaining > 0 && <p className="text-sm text-muted-foreground">Subtotal da seleção · {displayEth(subtotal)}</p>}
          <Button
            className="w-full"
            disabled={remaining === 0 || add.isPending || (cart.token !== null && cart.isPending)}
            onClick={() => add.mutate({ type: 'add', nftId: nft.id, editionId: edition.id, quantity: selectedQuantity })}
          >
            {add.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
          </Button>
          {add.isError && <p role="alert" className="text-destructive">{apiProblem(add.error)?.message ?? 'Não foi possível adicionar a edição.'}</p>}
          {add.isSuccess && (
            <p role="status" className="text-sm">
              Edição adicionada. <Link to="/carrinho" className="text-primary underline">Ver carrinho</Link>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export function NftDetail({ nftId }: { nftId: string }) {
  const nft = useNft(nftId)

  return (
    <section className="space-y-6">
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">Voltar ao catálogo</Link>
      {nft.isPending && (
        <div aria-label="Carregando obra" role="status" className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton aspect-[20/13] rounded-md" />
          <div className="skeleton min-h-52 rounded-md" />
        </div>
      )}
      {nft.isError && (
        apiProblem(nft.error)?.code === 'NFT_NOT_FOUND' ? (
          <h1 className="text-3xl font-semibold">Obra não encontrada</h1>
        ) : (
          <div className="space-y-3">
            <p role="alert">A obra não pôde ser carregada.</p>
            <Button onClick={() => void nft.refetch()}>Tentar novamente</Button>
          </div>
        )
      )}
      {nft.data && <NftDetails key={nft.data.id} nft={nft.data} />}
    </section>
  )
}
