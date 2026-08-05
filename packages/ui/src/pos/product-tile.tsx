'use client'
import { BadgeChain } from '../badge-chain'
import { BadgeBAES } from '../badge-baes'
import { cn, formatCLP } from '../lib/utils'
import { Scale } from 'lucide-react'

interface ProductTileProps {
  product: {
    id: string
    name: string
    priceRetail: number
    coldChain: 'ambient' | 'refrigerated' | 'frozen'
    isBaesEligible: boolean
    isWeighable: boolean
    stockTotal?: number
    imageUrl?: string | null
  }
  onAdd: (productId: string) => void
  disabled?: boolean
}

export function ProductTile({ product, onAdd, disabled }: ProductTileProps) {
  const outOfStock = (product.stockTotal ?? 0) <= 0

  return (
    <button
      onClick={() => !outOfStock && !disabled && onAdd(product.id)}
      disabled={outOfStock || disabled}
      className={cn(
        // Hit area mínimo 48pt — POS táctil
        'min-h-[var(--pos-hit-area-min)] w-full',
        'flex flex-col justify-between',
        'bg-elevated border border-[var(--color-border)] rounded-lg p-3',
        'text-left transition-all duration-fast',
        'active:scale-[0.97] active:shadow-none',
        'hover:border-brand/40 hover:shadow-pos',
        outOfStock && 'opacity-50 cursor-not-allowed',
        !outOfStock && !disabled && 'cursor-pointer',
      )}
      aria-label={`Agregar ${product.name} — ${formatCLP(product.priceRetail)}`}
    >
      {/* Badges top */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex flex-wrap gap-1">
          <BadgeChain type={product.coldChain} />
          {product.isBaesEligible && <BadgeBAES status="eligible" />}
        </div>
        {product.isWeighable && (
          <span className="text-text-muted" title="Producto pesable">
            <Scale size={13} />
          </span>
        )}
      </div>

      {/* Nombre */}
      <p className="text-sm font-semibold text-text font-body leading-snug line-clamp-2 flex-1">
        {product.name}
      </p>

      {/* Precio */}
      <p className="font-mono text-base font-bold text-brand mt-2">
        {formatCLP(product.priceRetail)}
        {product.isWeighable && <span className="text-xs font-normal text-text-muted"> /kg</span>}
      </p>

      {outOfStock && (
        <p className="text-xs text-text-muted font-body mt-1">Sin stock</p>
      )}
    </button>
  )
}
