'use client'
import { useState } from 'react'
import { cn, formatCLP } from '../lib/utils'
import { Snowflake, Droplets, Tag, Plus, Minus, ShoppingCart } from 'lucide-react'

interface B2BProduct {
  id:          string
  sku:         string
  slug:        string
  name:        string
  brand:       string | null
  priceRetail: number
  priceB2B:    number
  coldChain:   'frozen' | 'refrigerated' | 'ambient'
  isBaesEligible: boolean
  weightGrams: number | null
  stock:       number
}

interface B2BPricingTableProps {
  products:  B2BProduct[]
  className?: string
  // Cuando se pasa, agrega una columna "Pedido" con selector de cantidad +
  // botón "Agregar" que llama a este callback con el producto y la cantidad
  // elegida (adición post-entrega — antes esta tabla era solo informativa,
  // sin forma de armar un pedido real a precio mayorista). Sin este prop la
  // tabla queda 100% igual que antes (compatibilidad con cualquier otro uso).
  onAddToOrder?: (product: B2BProduct, qty: number) => void
}

function AddToOrderCell({ product, onAdd }: { product: B2BProduct; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const disabled = product.stock === 0

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        disabled={disabled || qty <= 1}
        onClick={() => setQty(q => Math.max(1, q - 1))}
        className="flex size-6 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-30"
      >
        <Minus size={11} />
      </button>
      <span className="w-6 text-center text-xs tabular-nums">{qty}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setQty(q => Math.min(product.stock, q + 1))}
        className="flex size-6 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-30"
      >
        <Plus size={11} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { onAdd(qty); setQty(1); setAdded(true); setTimeout(() => setAdded(false), 1200) }}
        className={cn(
          'flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-40',
          added ? 'bg-[var(--color-baes-eligible)]' : 'bg-[var(--color-brand)] hover:opacity-90'
        )}
      >
        <ShoppingCart size={12} /> {added ? 'Agregado' : 'Agregar'}
      </button>
    </div>
  )
}

export function B2BPricingTable({ products, className, onAddToOrder }: B2BPricingTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] py-16 text-center">
        <p className="text-[var(--color-text-secondary)]">Sin productos para mostrar</p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-[var(--color-border)]', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-sunken)] text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3 text-center">Cadena</th>
            <th className="px-4 py-3 text-right">P. Retail</th>
            <th className="px-4 py-3 text-right font-bold text-[var(--color-brand)]">P. Mayorista</th>
            <th className="px-4 py-3 text-right">Ahorro</th>
            <th className="px-4 py-3 text-right">Stock</th>
            {onAddToOrder && <th className="px-4 py-3 text-right">Pedido</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {products.map((p) => {
            const saving    = p.priceRetail - p.priceB2B
            const savingPct = Math.round((saving / p.priceRetail) * 100)

            return (
              <tr key={p.id} className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{p.sku}</td>

                <td className="px-4 py-3">
                  <p className="font-medium">{p.name}</p>
                  {p.brand && <p className="text-xs text-[var(--color-text-secondary)]">{p.brand}</p>}
                </td>

                <td className="px-4 py-3 text-center">
                  {p.coldChain === 'frozen' && (
                    <Snowflake className="mx-auto size-4 text-[var(--color-cold-frozen)]" />
                  )}
                  {p.coldChain === 'refrigerated' && (
                    <Droplets className="mx-auto size-4 text-blue-400" />
                  )}
                  {p.isBaesEligible && (
                    <Tag className="mx-auto size-4 text-[var(--color-baes-eligible)]" />
                  )}
                </td>

                <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-secondary)] line-through">
                  {formatCLP(p.priceRetail)}
                </td>

                <td className="px-4 py-3 text-right tabular-nums font-bold text-[var(--color-brand)]">
                  {formatCLP(p.priceB2B)}
                </td>

                <td className="px-4 py-3 text-right">
                  <span className="rounded-full bg-[var(--color-baes-eligible)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-baes-eligible)]">
                    -{savingPct}%
                  </span>
                </td>

                <td className={cn(
                  'px-4 py-3 text-right tabular-nums font-medium',
                  p.stock === 0 && 'text-[var(--color-dte-failed)]',
                  p.stock > 0 && p.stock < 5 && 'text-[var(--color-expiry-warning)]',
                  p.stock >= 5 && 'text-[var(--color-text)]',
                )}>
                  {p.stock === 0 ? 'Sin stock' : p.stock}
                </td>

                {onAddToOrder && (
                  <td className="px-4 py-3">
                    <AddToOrderCell product={p} onAdd={qty => onAddToOrder(p, qty)} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
