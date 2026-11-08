import { Link } from '@tanstack/react-router'
import { ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CatalogItem } from '@/contracts/catalog'
import { displayEth } from '@/lib/eth'

export function FeaturedCollections({ slides, explore }: { slides: CatalogItem[]; explore: (collection: string) => void }) {
  const [selected, setSelected] = useState(0)
  const index = selected % slides.length
  const slide = slides[index]

  return (
    <section aria-label="Coleções em destaque" aria-roledescription="carrossel" className="space-y-3">
      <Card className="grid gap-0 overflow-hidden border-border p-0 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="order-2 flex flex-col justify-center gap-4 p-5 sm:p-6 md:order-1 lg:px-9">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Coleção em destaque</Badge>
          <div aria-live="polite" aria-atomic="true" className="space-y-2">
            <h2 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl lg:text-4xl">{slide.collection}</h2>
            <p className="text-sm text-muted-foreground">{slide.title} · {slide.artist}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="h-11 sm:h-9" onClick={() => explore(slide.collection)}>
              Explorar coleção <ArrowDownRight aria-hidden="true" />
            </Button>
            <Link to="/nfts/$nftId" params={{ nftId: slide.id }} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              Ver obra
            </Link>
          </div>
        </div>
        <div className="relative order-1 min-h-40 overflow-hidden bg-muted md:order-2 md:min-h-56">
          {slide.cover && (
            <img
              src={slide.cover.url}
              alt={slide.cover.alt}
              width={800}
              height={520}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )}
          <span className="absolute right-3 bottom-3 rounded-md border border-white/15 bg-background/90 px-2.5 py-1 text-xs font-semibold tabular-nums">
            {displayEth(slide.priceEth)}
          </span>
        </div>
      </Card>
      {slides.length > 1 && (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" aria-label="Destaque anterior"
            onClick={() => setSelected((index + slides.length - 1) % slides.length)}><ChevronLeft aria-hidden="true" /></Button>
          {slides.map((item, position) => (
            <Button key={item.id} variant="ghost" size="icon-sm" className="size-11 sm:size-8"
              aria-label={`Destaque ${position + 1} de ${slides.length}`} aria-pressed={position === index}
              onClick={() => setSelected(position)}>
              <span className={`h-1.5 w-3 rounded-full ${position === index ? 'bg-primary' : 'bg-input'}`} />
            </Button>
          ))}
          <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" aria-label="Próximo destaque"
            onClick={() => setSelected((index + 1) % slides.length)}><ChevronRight aria-hidden="true" /></Button>
        </div>
      )}
    </section>
  )
}
