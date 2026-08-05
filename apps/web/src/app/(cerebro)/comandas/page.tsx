'use client'
import { useEffect, useState, useCallback } from 'react'
import { Clock, Truck, Train, ShoppingBag, RefreshCw } from 'lucide-react'
import { StatusPill, cn, formatCLP } from '@seul/ui'

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

const CHANNEL_ICONS: Record<Channel, typeof Truck> = {
  pos:       ShoppingBag,
  web:       ShoppingBag,
  b2b:       ShoppingBag,
  whatsapp:  ShoppingBag,
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

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function ComandaCard({ comanda, onMove }: {
  comanda: Comanda
  onMove: (id: string, status: OrderStatus) => void
}) {
  const mins = minutesSince(comanda.createdAt)
  const isUrgent = mins > 20
  const DeliveryIcon = DELIVERY_ICONS[comanda.deliveryMode]

  return (
    <div className={cn(
      'bg-elevated rounded-lg border p-3 space-y-2.5 shadow-sm',
      isUrgent ? 'border-error/40' : 'border-[var(--color-border)]',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-bold text-text">#{comanda.number}</span>
          <span className={cn(
            'ml-1.5 text-xs font-body uppercase tracking-wide px-1.5 py-0.5 rounded-full',
            comanda.channel === 'web'       && 'bg-brand/10 text-brand',
            comanda.channel === 'pos'       && 'bg-[var(--ink-100)] text-text-muted',
            comanda.channel === 'b2b'       && 'bg-accent/10 text-accent',
            comanda.channel === 'whatsapp'  && 'bg-[#25d366]/10 text-[#25d366]',
          )}>
            {comanda.channel.toUpperCase()}
          </span>
        </div>
        {comanda.dteStatus === 'failed' && (
          <span className="text-[10px] bg-error-subtle text-error px-1.5 py-0.5 rounded font-mono animate-pulse">
            DTE ✗
          </span>
        )}
      </div>

      {/* Delivery */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted font-body">
        <DeliveryIcon size={12} />
        <span>{DELIVERY_LABELS[comanda.deliveryMode]}</span>
        {comanda.metroStation && (
          <span className="text-[var(--color-channel-metro)] font-semibold">
            · {comanda.metroStation} {comanda.metroSlot && `(${comanda.metroSlot})`}
          </span>
        )}
      </div>

      {/* Tiempo + total */}
      <div className="flex items-center justify-between">
        <div className={cn(
          'flex items-center gap-1 text-xs font-mono',
          isUrgent ? 'text-error font-bold' : 'text-text-muted',
        )}>
          <Clock size={11} />
          {mins}m
        </div>
        <span className="font-mono text-sm font-bold text-text">
          {formatCLP(Number(comanda.total))}
        </span>
      </div>

      {/* Acciones rápidas */}
      <div className="flex gap-1.5 pt-1 border-t border-[var(--color-border)]">
        {comanda.status !== 'preparando' && (
          <button
            onClick={() => onMove(comanda.id, 'preparando')}
            className="flex-1 text-xs py-1.5 rounded bg-warning/10 text-yellow-700 hover:bg-warning/20 transition-colors font-body font-medium"
          >
            Preparar
          </button>
        )}
        {comanda.status !== 'lista' && (
          <button
            onClick={() => onMove(comanda.id, 'lista')}
            className="flex-1 text-xs py-1.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors font-body font-medium"
          >
            Lista ✓
          </button>
        )}
        <button
          onClick={() => onMove(comanda.id, 'nueva')}
          className="px-2 text-xs py-1.5 rounded bg-surface text-text-muted hover:bg-[var(--ink-100)] transition-colors font-body"
          title="Mover a Nueva"
        >
          ↩
        </button>
      </div>
    </div>
  )
}

export default function ComandasPage() {
  const [data, setData] = useState<KanbanData>({ nueva: [], preparando: [], lista: [] })
  const [loading, setLoading] = useState(true)

  const fetchComandas = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/orders/comandas`)
      const json = await res.json() as KanbanData
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchComandas()
    // Auto-refresh cada 30s
    const interval = setInterval(fetchComandas, 30_000)
    return () => clearInterval(interval)
  }, [fetchComandas])

  async function handleMove(orderId: string, status: OrderStatus) {
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

    await fetch(`${API}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const total = data.nueva.length + data.preparando.length + data.lista.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-elevated shrink-0">
        <div>
          <h1 className="font-headline text-xl font-bold text-text">Comandas</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">
            {total} pedido{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchComandas}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded hover:bg-surface"
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-3 gap-0 h-full divide-x divide-[var(--color-border)]">
          {COLUMNS.map(col => {
            const items = data[col.id]
            return (
              <div key={col.id} className="flex flex-col overflow-hidden">
                {/* Column header */}
                <div className={cn('px-4 py-3 border-b border-[var(--color-border)]', col.bg.split(' ')[0])}>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-semibold font-body', col.color)}>
                      {col.label}
                    </span>
                    <span className={cn(
                      'font-mono text-xs px-2 py-0.5 rounded-full font-bold',
                      col.bg, col.color,
                    )}>
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/50">
                  {loading && (
                    <div className="space-y-3">
                      {[1,2].map(i => (
                        <div key={i} className="h-28 bg-[var(--ink-100)] rounded-lg animate-pulse" />
                      ))}
                    </div>
                  )}
                  {!loading && items.length === 0 && (
                    <div className="text-center py-12 text-text-muted text-sm font-body opacity-60">
                      Sin pedidos
                    </div>
                  )}
                  {!loading && items.map(comanda => (
                    <ComandaCard
                      key={comanda.id}
                      comanda={comanda}
                      onMove={handleMove}
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
