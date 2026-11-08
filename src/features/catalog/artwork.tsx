import type { NftMedia } from '@/contracts/catalog'

export function Artwork({ media, eager = false, contain = false }: { media: NftMedia | null; eager?: boolean; contain?: boolean }) {
  return (
    <div className="aspect-[20/13] overflow-hidden rounded-md border border-input/60 bg-secondary">
      {media ? (
        <img
          src={media.url}
          alt={media.alt}
          width={800}
          height={520}
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#333b29,transparent_65%)]" aria-hidden="true">
          <span className="text-5xl text-primary/60">✳</span>
        </div>
      )}
    </div>
  )
}
