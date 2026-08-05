'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import {
  BadgeBAES, BadgeChain, BadgeExpiry, TrafficLight,
  cn, formatCLP,
} from '@seul/ui'

interface InventoryRowProps {
  item: {
    id: string
    productId: string
    productName: string
    sku: string
    brand?: string | null
    lot?: string | null
    quantity: number
    expiresAt?: string | null
    location: string
    coldChain: 'ambient' | 'refrigerated' | 'frozen'
    isBaesEligible: boolean
    categoryName?: string | null
    expiryStatus: 'fresh' | 'warning' | 'urgent' | 'expired' | null
  }
}

export function InventoryRow({ item }: InventoryRowProps) {
  const [expanded, setExpanded] = useState(false)

  const isAlert = item.expiryStatus === 'urgent' || item.expiryStatus === 'expired'

  return (
    <>
      <tr
        className={cn(
          'border-b border-[var(--color-border)] hover:bg-surface transition-colors cursor-pointer',
          isAlert && 'bg-error-subtle/30',
        )}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Semáforo */}
        <td className="px-4 py-3 w-8">
          {item.expiryStatus
            ? <TrafficLight status={item.expiryStatus} size="md" />
            : <span className="w-3 h-3 inline-block rounded-full bg-[var(--ink-100)]" />
          }
        </td>

        {/* Producto */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown size={14} className="text-text-muted shrink-0" />
              : <ChevronRight size={14} className="text-text-muted shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold text-text font-body">{item.productName}</p>
              <p className="text-xs text-text-muted font-mono">{item.sku}{item.brand && ` · ${item.brand}`}</p>
            </div>
          </div>
        </td>

        {/* Badges */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <BadgeChain type={item.coldChain} />
            {item.isBaesEligible && <BadgeBAES status="eligible" />}
          </div>
        </td>

        {/* Lote */}
        <td className="px-4 py-3 font-mono text-xs text-text-muted">
          {item.lot ?? '—'}
        </td>

        {/* Stock */}
        <td className="px-4 py-3 text-right">
          <span className={cn(
            'font-mono text-sm font-bold',
            item.quantity < 5 ? 'text-warning' : 'text-text',
          )}>
            {item.quantity.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-text-muted ml-1">un.</span>
        </td>

        {/* Vencimiento */}
        <td className="px-4 py-3 text-right">
          {item.expiresAt
            ? <BadgeExpiry expiresAt={new Date(item.expiresAt)} />
            : <span className="text-xs text-text-muted">Sin fecha</span>
          }
        </td>

        {/* Ubicación */}
        <td className="px-4 py-3 text-center">
          <span className="text-xs text-text-muted capitalize">{item.location}</span>
        </td>
      </tr>

      {/* Fila expandida — historial movimientos */}
      {expanded && (
        <tr className="bg-surface">
          <td colSpan={7} className="px-8 py-4">
            <MovementHistory productId={item.productId} />
          </td>
        </tr>
      )}
    </>
  )
}

function MovementHistory({ productId }: { productId: string }) {
  // Fase 1: placeholder — se conecta con /api/inventory/:productId/movements
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
      <Package size={14} />
      <span>Historial de movimientos — conectar con API en Fase 2</span>
    </div>
  )
}
