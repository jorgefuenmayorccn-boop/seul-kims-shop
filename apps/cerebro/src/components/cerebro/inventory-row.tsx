'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Pencil } from 'lucide-react'
import Link from 'next/link'
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

// Vista general de Inventario — de SOLO LECTURA (adición post-entrega,
// 2-sep-2026, pedido explícito del dueño). Antes de esta sesión, esta fila
// tenía acciones inline (+/-1, "marcar como vencido") que llamaban a
// POST /api/inventory/adjust — un endpoint que NUNCA existió en el backend
// (grep confirmado, 0 resultados), así que esos botones 404-eaban en
// silencio desde que se escribieron. El dueño pidió consolidar TODO el
// ingreso/ajuste de inventario dentro de Editar Producto (ver
// product-inventory.tsx) — esta vista general queda como resumen de solo
// lectura con semáforo de vencimiento, y el botón de ajuste ahora navega a
// la ficha del producto en vez de mutar en línea.
export function InventoryRow({ item }: InventoryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const isAlert = item.expiryStatus === 'urgent' || item.expiryStatus === 'expired'

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
            item.quantity < 5 ? 'text-warning' : 'text-text',
          )}>
            {item.quantity.toLocaleString('es-CL')}
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

        {/* Ajustar — navega a Editar Producto, donde vive el flujo real de
            agregar/ajustar lotes (ya no se muta en línea desde esta vista). */}
        <td className="px-4 py-3 text-right">
          <Link
            href={`/products/${item.productId}/edit`}
            title="Ajustar inventario en Editar Producto"
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-brand transition-colors"
          >
            <Pencil size={12} /> Ajustar
          </Link>
        </td>
      </tr>

      {/* Fila expandida — historial de movimientos (solo lectura) */}
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
  id:            string
  type:          string
  quantity:      number
  notes:         string | null
  createdAt:     string
  createdByName: string | null
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
    // GET /api/products/:id/inventory/movements (adición post-entrega) —
    // reemplaza a GET /api/inventory/:productId/movements, que esta fila
    // llamaba antes pero nunca existió en el backend (mismo gap que
    // POST /api/inventory/adjust, ver comentario de arriba).
    clientFetch<{ movements: Movement[] }>(`/api/products/${productId}/inventory/movements`)
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
            {m.createdByName && <span className="text-text-muted opacity-40">· {m.createdByName}</span>}
          </div>
          <span className="text-text-muted font-mono text-[10px]">
            {new Date(m.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
