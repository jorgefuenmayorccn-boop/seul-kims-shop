'use client'
import { useEffect, useState, useCallback } from 'react'
import { Clock, Truck, Train, ShoppingBag, RefreshCw, Printer, Banknote, CreditCard, Landmark, Wallet, PackageCheck } from 'lucide-react'
import { StatusPill, cn, formatCLP } from '@seul/ui'
import { renderComandaHtml, renderPosReceiptHtml, renderEtiquetaHtml } from '@seul/pdf-templates/client'
import type { ComandaPayload, TicketPayload, EtiquetaPayload } from '@seul/pdf-templates/client'

type OrderStatus = 'nueva' | 'preparando' | 'lista'
type Channel = 'pos' | 'web' | 'b2b' | 'whatsapp'
type DeliveryMode = 'rappi' | 'metro' | 'pickup' | 'shipping'
// Adición post-entrega — flujo de pago web. Solo channel='web' llega con
// paymentStatus='pending' hoy (POS/B2B nacen 'confirmed', ver migración 0021
// y POST /api/orders/:id/confirm-payment).
type PaymentStatus = 'pending' | 'confirmed'
type PaymentMethod = 'transferencia' | 'efectivo' | 'transbank' | 'credito_b2b'

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
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  // Rediseño B2B (adición post-entrega) — companyId habilita el cargo a
  // crédito; razonSocial se muestra en la tarjeta; readyAt marca si ya se
  // avisó al cliente que su pedido pickup/metro está listo para retirar.
  companyId: string | null
  razonSocial: string | null
  readyAt: string | null
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

// Impresión desde Cerebro (adición post-entrega — flujo de pago web). Cerebro
// no tiene el Print Agent ESC/POS local que sí existe en apps/pos (corre en
// 127.0.0.1:9101, atado físicamente a la impresora de la caja) — este panel
// puede abrirse desde cualquier computador de oficina, no necesariamente el
// que está junto a la impresora térmica. Se usa el mismo fallback de nivel 2
// que ya usa POS cuando el agente no está disponible: popup HTML +
// window.print(), suficiente para confirmar el flujo y para imprimir en
// cualquier impresora normal conectada a ese computador.
function printHtmlPopup(html: string): boolean {
  try {
    const win = window.open('', 'print_popup', 'width=420,height=820,scrollbars=yes')
    if (!win) return false
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
    return true
  } catch {
    return false
  }
}

async function fetchAndPrintComanda(orderId: string): Promise<boolean> {
  const res = await fetch(`${API}/api/orders/${orderId}/comanda`, { credentials: 'include' })
  if (!res.ok) return false
  const { comanda } = await res.json() as { comanda: ComandaPayload }
  return printHtmlPopup(renderComandaHtml(comanda))
}

async function fetchAndPrintTicket(orderId: string): Promise<boolean> {
  const res = await fetch(`${API}/api/orders/${orderId}/ticket`, { credentials: 'include' })
  if (!res.ok) return false
  const { ticket } = await res.json() as { ticket: TicketPayload }
  return printHtmlPopup(renderPosReceiptHtml(ticket))
}

async function fetchAndPrintEtiqueta(orderId: string): Promise<boolean> {
  const res = await fetch(`${API}/api/orders/${orderId}/etiqueta`, { credentials: 'include' })
  if (!res.ok) return false
  const { etiqueta } = await res.json() as { etiqueta: EtiquetaPayload }
  return printHtmlPopup(renderEtiquetaHtml(etiqueta))
}

function ComandaCard({ comanda, onMove, onPaymentConfirmed, onMarkedReady }: {
  comanda: Comanda
  onMove: (id: string, status: OrderStatus) => void
  onPaymentConfirmed: (id: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod) => void
  onMarkedReady: (id: string) => void
}) {
  const mins = minutesSince(comanda.createdAt)
  const isUrgent = mins > 20
  const DeliveryIcon = DELIVERY_ICONS[comanda.deliveryMode] ?? ShoppingBag

  const [confirming, setConfirming] = useState<PaymentMethod | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [markingReady, setMarkingReady] = useState(false)

  // "Marcar listo para retirar" (adición post-entrega) — pickup/metro,
  // cualquier canal. Envía el correo al cliente vía POST /api/orders/:id/ready.
  async function handleMarkReady() {
    if (markingReady) return
    setMarkingReady(true)
    try {
      const res = await fetch(`${API}/api/orders/${comanda.id}/ready`, {
        method: 'POST', credentials: 'include',
      })
      if (res.ok) onMarkedReady(comanda.id)
    } finally {
      setMarkingReady(false)
    }
  }

  // Confirmar pago (adición post-entrega): POST /api/orders/:id/confirm-payment,
  // y si sale bien, imprimir automáticamente comanda + Nota de Venta — el
  // dueño pidió explícitamente que esto sea automático, no dos pasos manuales
  // separados. Fallos de impresión (popup bloqueado, sin impresora) no
  // deshacen la confirmación de pago — el pedido ya quedó coordinado en el
  // sistema, el staff puede reimprimir manualmente si hace falta.
  async function handleConfirmPayment(method: PaymentMethod) {
    if (confirming) return
    setConfirming(method)
    setPaymentError('')
    try {
      const res = await fetch(`${API}/api/orders/${comanda.id}/confirm-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPaymentError(json.error ?? 'No se pudo confirmar el pago')
        return
      }
      onPaymentConfirmed(comanda.id, 'confirmed', method)
      await Promise.all([
        fetchAndPrintComanda(comanda.id),
        fetchAndPrintTicket(comanda.id),
      ])
    } catch {
      setPaymentError('Error de conexión')
    } finally {
      setConfirming(null)
    }
  }

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
          {comanda.razonSocial && (
            <span className="block text-[10px] font-body text-accent mt-0.5">{comanda.razonSocial}</span>
          )}
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

      {/* Pago — adición post-entrega, flujo de pago web. Solo pedidos web
          nacen payment_status='pending' (POS/B2B ya nacen 'confirmed'). Un
          pedido web pendiente de pago NO debería avanzar a preparación
          todavía — por eso este bloque va antes de "Preparar"/"Lista ✓". */}
      {comanda.channel === 'web' && comanda.paymentStatus === 'pending' && (
        <div className="pt-1 border-t border-[var(--color-border)] space-y-1.5">
          <p className="text-[10px] font-body font-semibold uppercase tracking-wide text-error">
            Pago sin coordinar
          </p>
          <div className={cn('grid gap-1', comanda.companyId ? 'grid-cols-4' : 'grid-cols-3')}>
            <button
              onClick={() => handleConfirmPayment('transferencia')}
              disabled={!!confirming}
              className="flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors font-body font-medium disabled:opacity-50"
              title="El cliente ya pagó por transferencia"
            >
              <Landmark size={13} />
              {confirming === 'transferencia' ? '...' : 'Transferencia'}
            </button>
            <button
              onClick={() => handleConfirmPayment('efectivo')}
              disabled={!!confirming}
              className="flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded bg-warning/10 text-yellow-700 hover:bg-warning/20 transition-colors font-body font-medium disabled:opacity-50"
              title="Cobrar en efectivo al entregar/retirar"
            >
              <Banknote size={13} />
              {confirming === 'efectivo' ? '...' : 'Efectivo puerta'}
            </button>
            <button
              onClick={() => handleConfirmPayment('transbank')}
              disabled={!!confirming}
              className="flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-body font-medium disabled:opacity-50"
              title="Cobrar con Transbank al entregar/retirar"
            >
              <CreditCard size={13} />
              {confirming === 'transbank' ? '...' : 'Transbank puerta'}
            </button>
            {comanda.companyId && (
              <button
                onClick={() => handleConfirmPayment('credito_b2b')}
                disabled={!!confirming}
                className="flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-body font-medium disabled:opacity-50"
                title="Cargar a la línea de crédito de la empresa"
              >
                <Wallet size={13} />
                {confirming === 'credito_b2b' ? '...' : 'Crédito B2B'}
              </button>
            )}
          </div>
          {paymentError && (
            <p className="text-[10px] text-error font-body">{paymentError}</p>
          )}
        </div>
      )}
      {comanda.channel === 'web' && comanda.paymentStatus === 'confirmed' && comanda.paymentMethod && (
        <div className="pt-1 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-[10px] font-body font-medium text-success flex items-center gap-1">
            ✓ {comanda.paymentMethod === 'transferencia' ? 'Pagado (transferencia)'
              : comanda.paymentMethod === 'efectivo' ? 'Cobrar efectivo en puerta'
              : comanda.paymentMethod === 'credito_b2b' ? 'Cargado a línea de crédito'
              : 'Cobrar Transbank en puerta'}
          </span>
          <button
            onClick={() => { fetchAndPrintComanda(comanda.id); fetchAndPrintTicket(comanda.id) }}
            className="text-[10px] text-text-muted hover:text-text transition-colors flex items-center gap-1"
            title="Reimprimir comanda y Nota de Venta"
          >
            <Printer size={11} />
            Reimprimir
          </button>
        </div>
      )}

      {/* Marcar listo para retirar — pickup/metro, cualquier canal (adición
          post-entrega). Independiente del estado de pago: es sobre si el
          pedido ya está físicamente listo, no sobre si ya se cobró. */}
      {(comanda.deliveryMode === 'pickup' || comanda.deliveryMode === 'metro') && (
        <div className="pt-1 border-t border-[var(--color-border)]">
          {comanda.readyAt ? (
            <span className="text-[10px] font-body font-medium text-success flex items-center gap-1">
              <PackageCheck size={12} /> Listo para retirar — cliente avisado
            </span>
          ) : (
            <button
              onClick={handleMarkReady}
              disabled={markingReady}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-body font-medium disabled:opacity-50"
            >
              <PackageCheck size={13} />
              {markingReady ? 'Avisando...' : 'Marcar listo para retirar'}
            </button>
          )}
        </div>
      )}

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
          onClick={() => fetchAndPrintEtiqueta(comanda.id)}
          className="px-2 text-xs py-1.5 rounded bg-surface text-text-muted hover:bg-[var(--ink-100)] transition-colors font-body"
          title="Imprimir etiqueta de caja"
        >
          <Printer size={13} />
        </button>
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
      // credentials: 'include' es obligatorio — cmr.seoulshop.cl y api.seoulshop.cl son
      // orígenes distintos (subdominios), así que sin esto el navegador nunca envía la
      // cookie seul_session y el endpoint responde 401 aunque curl (que sí manda la
      // cookie a mano) lo dé por bueno. Bug encontrado en auditoría de cierre Fase 1.
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
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
  }

  // Adición post-entrega — flujo de pago web. Actualización local optimista
  // tras un POST /api/orders/:id/confirm-payment exitoso — el endpoint ya
  // hizo el trabajo real (BD + DTE), esto solo evita esperar los 30s del
  // auto-refresh para que el badge de pago cambie en pantalla.
  function handlePaymentConfirmed(orderId: string, paymentStatus: PaymentStatus, paymentMethod: PaymentMethod) {
    setData(prev => {
      const patch = (list: Comanda[]) =>
        list.map(o => o.id === orderId ? { ...o, paymentStatus, paymentMethod } : o)
      return { nueva: patch(prev.nueva), preparando: patch(prev.preparando), lista: patch(prev.lista) }
    })
  }

  function handleMarkedReady(orderId: string) {
    setData(prev => {
      const patch = (list: Comanda[]) =>
        list.map(o => o.id === orderId ? { ...o, readyAt: new Date().toISOString() } : o)
      return { nueva: patch(prev.nueva), preparando: patch(prev.preparando), lista: patch(prev.lista) }
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
                      onPaymentConfirmed={handlePaymentConfirmed}
                      onMarkedReady={handleMarkedReady}
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
