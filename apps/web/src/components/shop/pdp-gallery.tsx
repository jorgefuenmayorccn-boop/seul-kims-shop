'use client'
import { useState } from 'react'
import Image from 'next/image'

interface PDPGalleryProps {
  name:     string
  images:   Array<{ id: string; url: string }>
  coverUrl: string | null | undefined
}

export function PDPGallery({ name, images, coverUrl }: PDPGalleryProps) {
  const allImages = images.length > 0
    ? images
    : coverUrl ? [{ id: 'cover', url: coverUrl }] : []

  const [active, setActive] = useState(0)
  const currentUrl = allImages[active]?.url ?? coverUrl

  return (
    <div className="space-y-3">
      {/* Imagen principal */}
      <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden border border-[var(--color-border)] flex items-center justify-center">
        {currentUrl ? (
          <Image
            src={currentUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain p-4"
            priority
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full" style={{ background: 'var(--color-celadon-light, #e8ede9)' }}>
            <span style={{ color: 'var(--color-celadon)', fontSize: 32, fontFamily: 'var(--font-korean)' }}>상품</span>
          </div>
        )}
      </div>

      {/* Miniaturas */}
      {allImages.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {allImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className="relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
              style={{ borderColor: i === active ? 'var(--color-brand)' : 'transparent' }}
              aria-label={`Imagen ${i + 1}`}
            >
              <Image src={img.url} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}

      {/* Miniatura única como fallback (si hay solo una imagen) */}
      {allImages.length === 1 && currentUrl && (
        <div className="flex gap-2">
          <div className="relative w-16 h-16 bg-surface rounded-lg border-2 border-brand/40 overflow-hidden">
            <Image src={currentUrl} alt="" fill className="object-cover" sizes="64px" />
          </div>
        </div>
      )}
    </div>
  )
}
