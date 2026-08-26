'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, MessageCircle } from 'lucide-react'
import { BadgeChain } from '../badge-chain'
import { BadgeBAES } from '../badge-baes'
import { BadgeExpiry } from '../badge-expiry'
import { BadgeNutrition } from '../badge-nutrition'
import { cn, formatCLP } from '../lib/utils'

export interface ProductCardData {
  id:             string
  slug:           string
  name:           string
  brand?:         string | null
  priceRetail:    number
  coldChain:      'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean
  isWeighable:    boolean
  stockTotal:     number
  nextExpiry?:    string | null
  imageUrl?:      string | null
  sellos?:        string[]
}

interface ProductCardProps {
  product: ProductCardData
  variant?: 'grid' | 'list'
  onAddToCart?: (id: string) => void
}

const SEUL_WA = '56936451991'

export function ProductCard({ product, variant = 'grid', onAddToCart }: ProductCardProps) {
  const outOfStock = product.stockTotal <= 0
  const waText = `¡Hola! Quiero comprar ${product.name}`
  const waHref = `https://wa.me/${SEUL_WA}?text=${encodeURIComponent(waText)}`

  if (variant === 'list') {
    return (
      <div className="flex gap-4 p-4 bg-elevated rounded-lg border border-[var(--color-border)] hover:shadow-md transition-shadow">
        {/* Imagen */}
        <div className="relative w-20 h-20 shrink-0 bg-surface rounded-md overflow-hidden">
          {product.imageUrl
            ? <Image src={product.imageUrl} alt={product.name} fill sizes="80px" className="object-cover" />
            : <span className="flex items-center justify-center h-full" style={{ fontSize: 18, fontFamily: 'var(--font-korean, serif)', color: 'var(--color-celadon, #6b8f71)' }}>상품</span>
          }
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-text-muted font-body">{product.brand}</p>
          <Link href={`/producto/${product.slug}`} className="font-semibold text-text hover:text-brand transition-colors font-body">
            {product.name}
          </Link>
          <div className="flex gap-1 flex-wrap">
            <BadgeChain type={product.coldChain} />
            {product.isBaesEligible && <BadgeBAES status="eligible" />}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-brand text-lg">{formatCLP(product.priceRetail)}</p>
          {outOfStock
            ? <p className="text-xs text-text-muted mt-1">Sin stock</p>
            : <button onClick={() => onAddToCart?.(product.id)} className="mt-2 text-xs px-3 py-1.5 bg-brand text-white rounded-md hover:bg-brand-hover transition-colors">
                Agregar
              </button>
          }
        </div>
      </div>
    )
  }

  // Grid variant
  return (
    <div className={cn(
      'group bg-elevated rounded-xl border border-[var(--color-border)] overflow-hidden',
      'hover:shadow-lg hover:border-brand/30 transition-all duration-normal',
      outOfStock && 'opacity-70',
    )}>
      {/* Imagen */}
      <Link href={`/producto/${product.slug}`} className="block relative aspect-square bg-surface overflow-hidden">
        {product.imageUrl
          ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-slow" />
          : <span className="flex items-center justify-center h-full" style={{ fontSize: 28, fontFamily: 'var(--font-korean, serif)', color: 'var(--color-celadon, #6b8f71)' }}>상품</span>
        }
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-text-muted bg-white px-2 py-1 rounded-full border">Agotado</span>
          </div>
        )}
        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <BadgeChain type={product.coldChain} />
          {product.isBaesEligible && <BadgeBAES status="eligible" />}
        </div>
        {/* Vencimiento próximo */}
        {product.nextExpiry && (
          <div className="absolute top-2 right-2">
            <BadgeExpiry expiresAt={new Date(product.nextExpiry)} />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          {product.brand && <p className="text-[11px] text-text-muted font-body">{product.brand}</p>}
          <Link href={`/producto/${product.slug}`} className="text-sm font-semibold text-text hover:text-brand transition-colors font-body line-clamp-2 leading-snug">
            {product.name}
          </Link>
        </div>

        {/* Sellos Alto En */}
        {product.sellos && product.sellos.length > 0 && (
          <BadgeNutrition sellos={product.sellos as ('sodio'|'grasas'|'azucares'|'calorias')[]} size="sm" />
        )}

        {/* Precio + acciones */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            <p className="font-mono font-bold text-brand text-base">
              {formatCLP(product.priceRetail)}
              {product.isWeighable && <span className="text-xs font-normal text-text-muted">/kg</span>}
            </p>
          </div>
          <div className="flex gap-1">
            {!outOfStock && (
              <button
                onClick={() => onAddToCart?.(product.id)}
                className="p-2 rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors"
                aria-label="Agregar al carrito"
              >
                <ShoppingCart size={14} />
              </button>
            )}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[var(--color-channel-whatsapp)]/10 text-[var(--color-channel-whatsapp)] hover:bg-[var(--color-channel-whatsapp)]/20 transition-colors"
              aria-label="Pedir por WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
