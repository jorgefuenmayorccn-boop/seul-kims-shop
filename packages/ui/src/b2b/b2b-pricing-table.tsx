'use client'
import { cn, formatCLP } from '../lib/utils'
import { Snowflake, Droplets, Tag } from 'lucide-react'

interface B2BProduct {
  id:          string
  sku:         string
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
}

export function B2BPricingTable({ products, className }: B2BPricingTableProps) {
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
