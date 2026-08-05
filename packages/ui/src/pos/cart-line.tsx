'use client'
import { Minus, Plus, Trash2, Scale } from 'lucide-react'
import { BadgeBAES } from '../badge-baes'
import { cn, formatCLP } from '../lib/utils'

export interface CartItem {
  id:          string   // productId
  name:        string
  quantity:    number   // puede ser decimal (kg)
  unitPrice:   number
  isWeighable: boolean
  isBaes:      boolean
  coldChain:   'ambient' | 'refrigerated' | 'frozen'
}

interface CartLineProps {
  item: CartItem
  baesActive: boolean   // si hay sesión BAES activa
  onRemove: (id: string) => void
  onQuantityChange: (id: string, qty: number) => void
}

export function CartLine({ item, baesActive, onRemove, onQuantityChange }: CartLineProps) {
  const subtotal = item.unitPrice * item.quantity
  const isEligible = baesActive && item.isBaes

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 px-4 border-b border-[var(--color-border)]',
      isEligible && 'bg-[var(--color-baes-applied-bg)]',
    )}>
      {/* Nombre + badge BAES */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-text font-body leading-snug truncate">
            {item.name}
          </p>
          {item.isWeighable && <Scale size={11} className="text-text-muted shrink-0" />}
        </div>
        {baesActive && (
          <BadgeBAES
            status={item.isBaes ? 'eligible' : 'not-eligible'}
            className="mt-1"
          />
        )}
        <p className="font-mono text-xs text-text-muted mt-0.5">
          {formatCLP(item.unitPrice)}{item.isWeighable ? '/kg' : ' c/u'}
        </p>
      </div>

      {/* Cantidad */}
      <div className="flex items-center gap-1">
        {!item.isWeighable && (
          <>
            <button
              onClick={() => onQuantityChange(item.id, Math.max(0, item.quantity - 1))}
              className="w-7 h-7 rounded-md bg-surface border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--ink-100)] transition-colors"
              aria-label="Reducir cantidad"
            >
              <Minus size={12} />
            </button>
            <span className="w-8 text-center font-mono text-sm font-semibold text-text">
              {item.quantity}
            </span>
            <button
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              className="w-7 h-7 rounded-md bg-surface border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--ink-100)] transition-colors"
              aria-label="Aumentar cantidad"
            >
              <Plus size={12} />
            </button>
          </>
        )}
        {item.isWeighable && (
          <span className="font-mono text-sm font-semibold text-text w-16 text-right">
            {item.quantity.toFixed(3)} kg
          </span>
        )}
      </div>

      {/* Subtotal + eliminar */}
      <div className="text-right shrink-0">
        <p className={cn(
          'font-mono text-sm font-bold',
          isEligible ? 'text-[var(--color-baes-applied-text)]' : 'text-text',
        )}>
          {formatCLP(subtotal)}
        </p>
        <button
          onClick={() => onRemove(item.id)}
          className="mt-1 text-text-muted hover:text-error transition-colors"
          aria-label="Eliminar producto"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
