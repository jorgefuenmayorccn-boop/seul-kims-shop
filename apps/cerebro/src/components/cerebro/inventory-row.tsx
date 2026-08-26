'use client'
import { useState, useTransition, useEffect } from 'react'
import { ChevronDown, ChevronRight, Minus, Plus, Trash2, Loader2 } from 'lucide-react'
import {
  BadgeBAES, BadgeChain, BadgeExpiry, TrafficLight,
  cn,
} from '@seul/ui'
import { clientFetch } from '@/lib/client-api'

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
  const [expanded, setExpanded]   = useState(false)
  const [quantity, setQuantity]   = useState(item.quantity)
  const [isPending, startTransition] = useTransition()
  const [error, setError]         = useState('')

  const isAlert = item.expiryStatus === 'urgent' || item.expiryStatus === 'expired'

  function adjust(delta: number) {
    setError('')
    startTransition(async () => {
      try {
        await clientFetch('/api/inventory/adjust', {
          method: 'POST',
          body: JSON.stringify({
            productId:   item.productId,
            inventoryId: item.id,
            quantity:    delta,
            type:        'adjustment',
          }),
        })
        setQuantity(q => q + delta)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al ajustar.')
      }
    })
  }

  function markExpired() {
    if (!confirm(`¿Marcar lote ${item.lot ?? item.id.slice(0, 8)} como vencido? El stock quedará en 0.`)) return
    setError('')
    startTransition(async () => {
      try {
        const delta = -quantity
        await clientFetch('/api/inventory/adjust', {
          method: 'POST',
          body: JSON.stringify({
            productId:   item.productId,
            inventoryId: item.id,
            quantity:    delta,
            type:        'expired',
            notes:       'Marcado como vencido desde Cerebro',
          }),
        })
        setQuantity(0)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al marcar.')
      }
    })
  }

  return (
    <>
      <tr
        className={cn(
          'border-b border-[var(--color-border)] hover:bg-surface transition-colors',
          isAlert && 'bg-error-subtle/30',
        )}
      >
        {/* Semáforo */}
        <td className="px-4 py-3 w-8 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          {item.expiryStatus
            ? <TrafficLight status={item.expiryStatus} size="md" />
            : <span className="w-3 h-3 inline-block rounded-full bg-[var(--ink-100)]" />
          }
        </td>

        {/* Producto */}
        <td className="px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
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
        <td className="px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <BadgeChain type={item.coldChain} />
            {item.isBaesEligible && <BadgeBAES status="eligible" />}
          </div>
        </td>

        {/* Lote */}
        <td className="px-4 py-3 font-mono text-xs text-text-muted cursor-pointer" onClick={() => setExpanded(e => !e)}>
          {item.lot ?? '—'}
        </td>

        {/* Stock */}
        <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <span className={cn(
            'font-mono text-sm font-bold',
            quantity < 5 ? 'text-warning' : 'text-text',
          )}>
            {quantity.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-text-muted ml-1">un.</span>
        </td>

        {/* Vencimiento */}
        <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setExpanded(e => !e)}>
          {item.expiresAt
            ? <BadgeExpiry expiresAt={new Date(item.expiresAt)} />
            : <span className="text-xs text-text-muted">Sin fecha</span>
          }
        </td>

        {/* Ubicación */}
        <td className="px-4 py-3 text-center cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <span className="text-xs text-text-muted capitalize">{item.location}</span>
        </td>

        {/* Acciones inline */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {isPending
              ? <Loader2 size={14} className="animate-spin text-text-muted" />
              : (
                <>
                  <button
                    onClick={() => adjust(-1)}
                    disabled={quantity <= 0}
                    title="Restar 1 unidad"
                    className="p-1 rounded hover:bg-surface text-text-muted hover:text-brand transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    onClick={() => adjust(1)}
                    title="Sumar 1 unidad"
                    className="p-1 rounded hover:bg-surface text-text-muted hover:text-brand transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={markExpired}
                    disabled={quantity === 0}
                    title="Marcar lote como vencido"
                    className="p-1 rounded hover:bg-surface text-text-muted hover:text-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )
            }
          </div>
          {error && <p className="text-[10px] text-error mt-1 text-right">{error}</p>}
        </td>
      </tr>

      {/* Fila expandida — historial movimientos */}
      {expanded && (
        <tr className="bg-surface">
          <td colSpan={8} className="px-8 py-4">
            <MovementHistory productId={item.productId} />
          </td>
        </tr>
      )}
    </>
  )
}

interface Movement {
  id:          string
  type:        string
  quantity:    number
  notes:       string | null
  createdAt:   string
}

const MOVE_LABEL: Record<string, string> = {
  purchase:   'Ingreso lote',
  sale:       'Venta',
  adjustment: 'Ajuste manual',
  expired:    'Vencido / baja',
  return:     'Devolución',
}

function MovementHistory({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    clientFetch<{ movements: Movement[] }>(`/api/inventory/${productId}/movements`)
      .then(d => setMovements(d.movements))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) return <div className="text-xs text-text-muted py-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Cargando movimientos…</div>
  if (movements.length === 0) return <div className="text-xs text-text-muted py-2">Sin movimientos registrados.</div>

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Últimos movimientos</p>
      {movements.map(m => (
        <div key={m.id} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold ${m.quantity >= 0 ? 'text-success' : 'text-error'}`}>
              {m.quantity >= 0 ? '+' : ''}{m.quantity}
            </span>
            <span className="text-text-muted">{MOVE_LABEL[m.type] ?? m.type}</span>
            {m.notes && <span className="text-text-muted opacity-60">{m.notes}</span>}
          </div>
          <span className="text-text-muted font-mono text-[10px]">
            {new Date(m.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
