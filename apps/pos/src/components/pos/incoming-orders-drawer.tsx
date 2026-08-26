'use client'
import { useState, useCallback, useEffect } from 'react'
import { X, Inbox, Printer, CheckCircle2 } from 'lucide-react'
import { useIncomingOrders, markOrderSeen, markAllSeen, removeIncomingOrder, type IncomingOrder } from '@/lib/order-events'
import { printComanda } from '@/lib/print-service'
import type { ComandaPayload } from '@seul/pdf-templates/client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface IncomingOrdersDrawerProps {
  onClose: () => void
}

function channelLabel(ch: string) {
  if (ch === 'web')      return 'Web'
  if (ch === 'whatsapp') return 'WhatsApp'
  if (ch === 'b2b')      return 'B2B'
  return ch
}

function deliveryLabel(mode: string, station?: string, slot?: string) {
  if (mode === 'metro')    return `Metro${station ? ` · ${station}` : ''}${slot ? ` · ${slot}` : ''}`
  if (mode === 'rappi')    return 'Rappi'
  if (mode === 'pickup')   return 'Retiro en tienda'
  if (mode === 'shipping') return 'Despacho a región'
  return mode
}

function clp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`
  return `hace ${Math.floor(diff / 3600)}h`
}

export function IncomingOrdersDrawer({ onClose }: IncomingOrdersDrawerProps) {
  const orders = useIncomingOrders()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="flex flex-col w-80 h-full shadow-2xl border-l"
        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Pedidos entrantes
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {orders.length === 0 ? 'Sin pedidos' : `${orders.length} pedido${orders.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {orders.some(o => !o.seenAt) && (
              <button
                onClick={markAllSeen}
                className="font-body text-xs px-2 py-1 rounded transition-colors hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Marcar todos leídos
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Inbox size={40} className="opacity-40" style={{ color: 'var(--color-text-muted)' }} />
              <p className="font-body text-sm">Sin pedidos web entrantes</p>
              <p className="font-body text-xs opacity-60">
                Los pedidos de la tienda online aparecen aquí en tiempo real
              </p>
            </div>
          ) : (
            orders.map(order => (
              <OrderCard
                key={order.orderId}
                order={order}
                onSeen={() => markOrderSeen(order.orderId)}
                onDismiss={() => removeIncomingOrder(order.orderId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function OrderCard({
  order,
  onSeen,
  onDismiss,
}: {
  order:     IncomingOrder
  onSeen:    () => void
  onDismiss: () => void
}) {
  const [printing,    setPrinting]    = useState(false)
  const [preparing,   setPreparing]   = useState(false)
  const [listando,    setListando]    = useState(false)
  const [printResult, setPrintResult] = useState<'ok' | 'err' | null>(null)

  const handlePrintComanda = useCallback(async () => {
    if (printing) return
    setPrinting(true)
    setPrintResult(null)
    onSeen()

    try {
      // Obtener payload de comanda desde la API (incluye nombres de productos)
      const res = await fetch(`${API}/api/orders/${order.orderId}/comanda`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as { comanda: ComandaPayload }
      const result = await printComanda(data.comanda)
      setPrintResult(result.ok ? 'ok' : 'err')
    } catch {
      setPrintResult('err')
    } finally {
      setPrinting(false)
    }
  }, [order.orderId, printing, onSeen])

  const handleMarkPreparing = useCallback(async () => {
    if (preparing) return
    setPreparing(true)
    try {
      await fetch(`${API}/api/orders/${order.orderId}/status`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status: 'preparando' }),
      })
      onDismiss()
    } catch {
      setPreparing(false)
    }
  }, [order.orderId, preparing, onDismiss])

  const handleMarkLista = useCallback(async () => {
    if (listando) return
    setListando(true)
    try {
      await fetch(`${API}/api/orders/${order.orderId}/status`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status: 'lista' }),
      })
      onDismiss()
    } catch {
      setListando(false)
    }
  }, [order.orderId, listando, onDismiss])

  const isUnread = !order.seenAt

  return (
    <div
      className="border-b p-4 space-y-3 transition-colors"
      style={{
        borderColor: 'var(--color-border)',
        background:  isUnread ? 'var(--color-brand-subtle, rgba(215,38,61,0.04))' : 'transparent',
      }}
      onClick={onSeen}
    >
      {/* Header de la tarjeta */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isUnread && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--color-brand)' }}
            />
          )}
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              #{order.number}
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {channelLabel(order.channel)} · {timeAgo(order.createdAt)}
            </p>
          </div>
        </div>
        <p className="font-mono text-sm font-bold shrink-0" style={{ color: 'var(--color-text)' }}>
          {clp(order.total)}
        </p>
      </div>

      {/* Entrega */}
      <div
        className="text-xs font-body px-2.5 py-1.5 rounded"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
      >
        {deliveryLabel(order.deliveryMode, order.metroStation, order.metroSlot)}
        {order.notes && (
          <span className="block mt-0.5 italic">&ldquo;{order.notes}&rdquo;</span>
        )}
      </div>

      {/* Resumen items */}
      <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {order.itemCount} producto{order.itemCount !== 1 ? 's' : ''}
      </p>

      {/* Acciones */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handlePrintComanda() }}
          disabled={printing}
          className="flex-1 py-2 text-xs font-semibold font-body rounded transition-colors"
          style={{
            background: printResult === 'ok'  ? 'var(--color-dte-issued)'
                      : printResult === 'err' ? 'var(--color-error)'
                      : 'var(--color-text)',
            color: '#fff',
            opacity: printing ? 0.6 : 1,
          }}
        >
          {printing        ? 'Imprimiendo…'
           : printResult === 'ok'  ? '✓ Impreso'
           : printResult === 'err' ? '✗ Error'
           : <><Printer size={13} className="inline mr-1" />Imprimir comanda</>}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleMarkPreparing() }}
          disabled={preparing}
          className="px-3 py-2 text-xs font-body rounded border transition-colors hover:opacity-70"
          style={{
            borderColor: 'var(--color-border)',
            color:       'var(--color-text-muted)',
            opacity:     preparing ? 0.6 : 1,
          }}
        >
          {preparing ? '…' : 'Preparando'}
        </button>

        {order.deliveryMode !== 'pickup' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleMarkLista() }}
            disabled={listando}
            className="px-3 py-2 text-xs font-body rounded border transition-colors hover:opacity-70 flex items-center gap-1"
            style={{
              borderColor: 'var(--color-dte-issued, #16a34a)',
              color:       'var(--color-dte-issued, #16a34a)',
              opacity:     listando ? 0.6 : 1,
            }}
          >
            {listando ? '…' : <><CheckCircle2 size={12} />Lista ✓</>}
          </button>
        )}
      </div>
    </div>
  )
}
