'use client'
import { useEffect, useState, useCallback } from 'react'
import { Clock, Truck, Train, ShoppingBag, RefreshCw, X, Printer } from 'lucide-react'
import { cn, formatCLP } from '@seul/ui'
import { ComandaPaymentPanel, ComandaReadyButton, type ComandaPaymentMethod } from '@seul/ui/pos/comanda-payment-panel'
import type { ComandaPayload, TicketPayload } from '@seul/pdf-templates/client'
import { printComanda, printTicket } from '@/lib/print-service'

// Vista de Comandas dentro de POS — reusa el mismo backend que el Kanban de
// cerebro (apps/cerebro/src/app/(admin)/comandas/page.tsx): GET /api/orders/comandas
// y PATCH /api/orders/:id/status. La cajera (rol staff) no tiene acceso a
// cmr.seoulshop.cl en el flujo real, así que necesita esto sin salir de POS.
// Adaptada para tablet táctil: botones con altura mínima var(--pos-hit-area-min)
// y un único botón "Siguiente estado" en vez de mover tarjetas con drag-and-drop.

type OrderStatus = 'nueva' | 'preparando' | 'lista'
type Channel = 'pos' | 'web' | 'b2b' | 'whatsapp'
type DeliveryMode = 'rappi' | 'metro' | 'pickup' | 'shipping'

interface Comanda {
  id: string
  number: number
  channel: Channel
  status: OrderStatus
  deliveryMode: DeliveryMode
  metroStation: string | null
  metroSlot: string | null
  total: string
  dteStatus: 'pending' | 'issued' | 'failed'
  createdAt: string
  itemCount: number
  // Pago pendiente + crédito B2B + "listo para retirar" (adición
  // post-entrega, 3-sep-2026) — GET /api/orders/comandas ya devuelve estos
  // campos desde la ronda de esta tarde, esta vista nunca los consumía.
  paymentStatus: 'pending' | 'confirmed'
  paymentMethod: ComandaPaymentMethod | null
  companyId:     string | null
  razonSocial:   string | null
  readyAt:       string | null
}

interface KanbanData {
  nueva: Comanda[]
  preparando: Comanda[]
  lista: Comanda[]
}

const COLUMNS: { id: OrderStatus; label: string; color: string; bg: string }[] = [
  { id: 'nueva',      label: 'Nueva',      color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { id: 'preparando', label: 'Preparando', color: 'text-yellow-700', bg: 'bg-amber-50 border-amber-200' },
  { id: 'lista',      label: 'Lista ✓',   color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
]

// Siguiente estado en el flujo lineal nueva → preparando → lista (botón único, táctil)
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  nueva: 'preparando',
  preparando: 'lista',
  lista: null,
}

const NEXT_LABEL: Record<OrderStatus, string> = {
  nueva: 'Comenzar preparación',
  preparando: 'Marcar lista ✓',
  lista: '',
}

const DELIVERY_ICONS: Record<DeliveryMode, typeof Truck> = {
  rappi:    Truck,
  metro:    Train,
  pickup:   ShoppingBag,
  shipping: Truck,
}

const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  rappi:    'Rappi',
  metro:    'Metro Merval',
  pickup:   'Retiro tienda',
  shipping: 'Despacho',
}

const CHANNEL_LABELS: Record<Channel, string> = {
  pos: 'POS', web: 'WEB', b2b: 'B2B', whatsapp: 'WSP',
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// Fetch + imprimir vía el print-service real de POS (Print Agent local si
// está disponible, si no popup HTML) — a diferencia de cerebro (que no
// tiene impresora física atada, siempre usa popup), esta vista SÍ debe
// intentar el agente primero para los tickets.
async function fetchAndPrintComanda(orderId: string): Promise<void> {
  const res = await fetch(`${API}/api/orders/${orderId}/comanda`, { credentials: 'include' })
  if (!res.ok) return
  const { comanda } = await res.json() as { comanda: ComandaPayload }
  await printComanda(comanda)
}

async function fetchAndPrintTicket(orderId: string): Promise<void> {
  const res = await fetch(`${API}/api/orders/${orderId}/ticket`, { credentials: 'include' })
  if (!res.ok) return
  const { ticket } = await res.json() as { ticket: TicketPayload }
  await printTicket(ticket)
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

interface ComandasViewProps {
  onClose: () => void
}

export function ComandasView({ onClose }: ComandasViewProps) {
  const [data, setData] = useState<KanbanData>({ nueva: [], preparando: [], lista: [] })
  const [loading, setLoading] = useState(true)

  const fetchComandas = useCallback(async () => {
    try {
      // credentials: 'include' es obligatorio — pos.seoulshop.cl y api.seoulshop.cl
      // son orígenes distintos; sin esto el navegador no manda la cookie seul_session
      // y el endpoint responde 401 aunque curl (que la manda a mano) lo dé por bueno.
      // Mismo bug que se encontró y arregló en cerebro/comandas (commit f32a532).
      const res = await fetch(`${API}/api/orders/comandas`, { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json() as KanbanData
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchComandas()
    const interval = setInterval(fetchComandas, 30_000)
    return () => clearInterval(interval)
  }, [fetchComandas])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleAdvance(orderId: string, from: OrderStatus) {
    const status = NEXT_STATUS[from]
    if (!status) return

    // Optimistic update
    setData(prev => {
      const all = [...prev.nueva, ...prev.preparando, ...prev.lista]
      const order = all.find(o => o.id === orderId)
      if (!order) return prev
      const updated = { ...order, status }
      return {
        nueva:      status === 'nueva'      ? [...prev.nueva.filter(o => o.id !== orderId), updated] : prev.nueva.filter(o => o.id !== orderId),
        preparando: status === 'preparando' ? [...prev.preparando.filter(o => o.id !== orderId), updated] : prev.preparando.filter(o => o.id !== orderId),
        lista:      status === 'lista'      ? [...prev.lista.filter(o => o.id !== orderId), updated] : prev.lista.filter(o => o.id !== orderId),
      }
    })

    try {
      await fetch(`${API}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
    } catch {
      // Si falla, el próximo auto-refresh (30s) corrige el estado optimista
    }
  }

  // Actualización optimista tras confirmar pago / marcar listo — el
  // endpoint ya hizo el trabajo real (BD + DTE), esto solo evita esperar
  // los 30s del auto-refresh (mismo patrón que cerebro).
  function patchComanda(orderId: string, patch: Partial<Comanda>) {
    setData(prev => {
      const apply = (list: Comanda[]) => list.map(o => o.id === orderId ? { ...o, ...patch } : o)
      return { nueva: apply(prev.nueva), preparando: apply(prev.preparando), lista: apply(prev.lista) }
    })
  }

  async function handlePaymentConfirmed(orderId: string, method: ComandaPaymentMethod) {
    patchComanda(orderId, { paymentStatus: 'confirmed', paymentMethod: method })
    await Promise.all([fetchAndPrintComanda(orderId), fetchAndPrintTicket(orderId)])
  }

  const total = data.nueva.length + data.preparando.length + data.lista.length

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
      >
        <div>
          <p className="font-headline text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Comandas
          </p>
          <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {total} pedido{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchComandas}
            className="flex items-center gap-1.5 font-body text-xs px-3 rounded transition-colors hover:opacity-70"
            style={{ minHeight: 'var(--pos-hit-area-min)', color: 'var(--color-text-muted)' }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded transition-colors hover:opacity-70"
            style={{ width: 'var(--pos-hit-area-min)', height: 'var(--pos-hit-area-min)', color: 'var(--color-text-muted)' }}
            aria-label="Cerrar Comandas"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-3 gap-0 h-full divide-x" style={{ borderColor: 'var(--color-border)' }}>
          {COLUMNS.map(col => {
            const items = data[col.id]
            return (
              <div key={col.id} className="flex flex-col overflow-hidden">
                {/* Column header */}
                <div className={cn('px-4 py-3 border-b', col.bg.split(' ')[0])} style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-semibold font-body', col.color)}>
                      {col.label}
                    </span>
                    <span className={cn('font-mono text-xs px-2 py-0.5 rounded-full font-bold', col.bg, col.color)}>
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {loading && (
                    <div className="space-y-3">
                      {[1, 2].map(i => (
                        <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: 'var(--color-surface)' }} />
                      ))}
                    </div>
                  )}
                  {!loading && items.length === 0 && (
                    <div className="text-center py-12 font-body text-sm opacity-60" style={{ color: 'var(--color-text-muted)' }}>
                      Sin pedidos
                    </div>
                  )}
                  {!loading && items.map(comanda => (
                    <ComandaCard
                      key={comanda.id}
                      comanda={comanda}
                      onAdvance={handleAdvance}
                      onPaymentConfirmed={handlePaymentConfirmed}
                      onMarkedReady={(id) => patchComanda(id, { readyAt: new Date().toISOString() })}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ComandaCard({ comanda, onAdvance, onPaymentConfirmed, onMarkedReady }: {
  comanda: Comanda
  onAdvance: (id: string, from: OrderStatus) => void
  onPaymentConfirmed: (id: string, method: ComandaPaymentMethod) => void
  onMarkedReady: (id: string) => void
}) {
  const mins = minutesSince(comanda.createdAt)
  const isUrgent = mins > 20
  const DeliveryIcon = DELIVERY_ICONS[comanda.deliveryMode] ?? ShoppingBag
  const nextLabel = NEXT_LABEL[comanda.status]

  return (
    <div
      className="rounded-lg border p-3 space-y-2.5"
      style={{
        background:  'var(--color-surface-elevated)',
        borderColor: isUrgent ? 'var(--color-error)' : 'var(--color-border)',
        boxShadow:   'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            #{comanda.number}
          </span>
          <span
            className="text-[10px] font-body uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
          >
            {CHANNEL_LABELS[comanda.channel] ?? comanda.channel.toUpperCase()}
          </span>
          {comanda.razonSocial && (
            <span className="text-[10px] font-body text-accent">{comanda.razonSocial}</span>
          )}
        </div>
        {comanda.dteStatus === 'failed' && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
          >
            DTE ✗
          </span>
        )}
      </div>

      {/* Delivery */}
      <div className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--color-text-muted)' }}>
        <DeliveryIcon size={12} />
        <span>{DELIVERY_LABELS[comanda.deliveryMode]}</span>
        {comanda.metroStation && (
          <span style={{ color: 'var(--color-channel-metro, var(--color-text-muted))', fontWeight: 600 }}>
            · {comanda.metroStation} {comanda.metroSlot && `(${comanda.metroSlot})`}
          </span>
        )}
      </div>

      {/* Tiempo + total */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1 text-xs font-mono"
          style={{ color: isUrgent ? 'var(--color-error)' : 'var(--color-text-muted)', fontWeight: isUrgent ? 700 : 400 }}
        >
          <Clock size={11} />
          {mins}m
        </div>
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
          {formatCLP(Number(comanda.total))}
        </span>
      </div>

      {/* Pago pendiente / confirmado + reimprimir (adición post-entrega,
          3-sep-2026 — antes esta vista no tenía nada de esto, la cajera no
          podía confirmar método de pago ni imprimir la boleta desde acá). */}
      {(comanda.channel === 'web' || comanda.channel === 'b2b') && (
        <ComandaPaymentPanel
          apiUrl={API}
          orderId={comanda.id}
          paymentStatus={comanda.paymentStatus}
          paymentMethod={comanda.paymentMethod}
          companyId={comanda.companyId}
          onConfirmed={(method) => onPaymentConfirmed(comanda.id, method)}
          onPrint={() => { fetchAndPrintComanda(comanda.id); fetchAndPrintTicket(comanda.id) }}
          compact
        />
      )}

      {(comanda.deliveryMode === 'pickup' || comanda.deliveryMode === 'metro') && (
        <ComandaReadyButton
          apiUrl={API}
          orderId={comanda.id}
          readyAt={comanda.readyAt}
          onMarked={() => onMarkedReady(comanda.id)}
          compact
        />
      )}

      {/* Acción táctil única — siguiente estado del flujo */}
      {nextLabel && (
        <button
          onClick={() => onAdvance(comanda.id, comanda.status)}
          className="w-full font-body text-sm font-semibold rounded transition-colors active:scale-[0.98]"
          style={{
            minHeight:  'var(--pos-hit-area-min)',
            background: comanda.status === 'nueva' ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-dte-issued, #16a34a)',
            color:      '#fff',
          }}
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}
