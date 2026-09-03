'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore, useCustomerHasHydrated } from '@/lib/customer-store'
import { ShopFooter } from '@seul/ui/shop/shop-footer'
import { Package } from '@seul/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// Ampliado (adición post-entrega, 3-sep-2026 — el dueño reportó que esta
// pantalla no mostraba nada en tiempo real: sin estado de pago, sin modo de
// entrega, sin info del repartidor). Aplica igual a pedidos B2B — son
// orders normales con company_id, el mismo endpoint ya los cubre.
interface OrderSummary {
  id:             string
  number:         number
  total:          string
  status:         string
  dteStatus:      string
  channel:        string
  createdAt:      string
  paymentStatus:  string | null
  paymentMethod:  string | null
  deliveryMode:   string | null
  metroStation:   string | null
  metroSlot:      string | null
  deliveryDate:   string | null
  readyAt:        string | null
  deliveryStatus: string | null
  driverName:     string | null
}

function formatCLP(v: string | number) {
  return `$${Number(v).toLocaleString('es-CL')}`
}

// Bug real corregido acá: este mapa tenía claves en inglés (pending/
// confirmed/preparing/...) que NUNCA coinciden con el enum real de
// order_status (nueva|preparando|lista|en_ruta|entregada|cancelada) — el
// fallback `?? s` mostraba siempre el valor crudo sin traducir.
function statusLabel(s: string) {
  const map: Record<string, string> = {
    nueva:      'Recibido',
    preparando: 'Preparando',
    lista:      'Listo',
    en_ruta:    'En camino',
    entregada:  'Entregado',
    cancelada:  'Cancelado',
  }
  return map[s] ?? s
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transferencia: 'Transferencia', efectivo: 'Efectivo al recibir',
  transbank: 'Transbank al recibir', credito_b2b: 'Cargo a línea de crédito',
}

const DELIVERY_MODE_LABEL: Record<string, string> = {
  metro: 'Retiro Metro Merval', pickup: 'Retiro en tienda',
  shipping: 'Despacho a regiones', delivery: 'Delivery', rappi: 'Rappi Express',
}

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending: 'Esperando repartidor', assigned: 'Repartidor asignado',
  accepted: 'Repartidor en camino', picked_up: 'Repartidor en camino',
  delivered: 'Entregado', failed: 'No se pudo entregar',
}

function formatDeliveryDate(iso: string) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const d = new Date(`${iso}T00:00:00`)
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function OrderDetail({ order }: { order: OrderSummary }) {
  const lines: string[] = []
  if (order.deliveryMode) lines.push(DELIVERY_MODE_LABEL[order.deliveryMode] ?? order.deliveryMode)
  if (order.deliveryMode === 'metro' && order.metroStation) {
    let s = `Estación ${order.metroStation}`
    if (order.deliveryDate) s += ` · ${formatDeliveryDate(order.deliveryDate)}`
    if (order.metroSlot) s += ` · ${order.metroSlot}`
    lines.push(s)
  }

  return (
    <div className="mt-2 space-y-1">
      {lines.map((l, i) => (
        <p key={i} className="font-body text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>{l}</p>
      ))}

      {order.readyAt && (
        <p className="font-body text-xs font-semibold" style={{ color: 'var(--color-celadon)' }}>
          ✓ Listo para retirar
        </p>
      )}
      {order.deliveryStatus && (
        <p className="font-body text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
          {DELIVERY_STATUS_LABEL[order.deliveryStatus] ?? order.deliveryStatus}
          {order.driverName && order.deliveryStatus !== 'pending' ? ` · ${order.driverName}` : ''}
        </p>
      )}

      {order.paymentStatus === 'pending' ? (
        <p className="font-body text-xs font-semibold" style={{ color: 'var(--color-seoul-red)' }}>
          Pago pendiente — revisa tu correo para completarlo
        </p>
      ) : order.paymentMethod && (
        <p className="font-body text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
          Pago: {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
        </p>
      )}
    </div>
  )
}

export default function PedidosPage() {
  const { customer } = useCustomerStore()
  const hasHydrated = useCustomerHasHydrated()
  const router = useRouter()
  const [orders, setOrders]     = useState<OrderSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Hallazgo S17 (auditoría visual final, mismo patrón que dashboard/perfil):
  // esperar a que zustand/persist termine de hidratar desde localStorage antes
  // de decidir "no hay sesión" — si no, una carga de página fresca (URL
  // directa, recarga) mandaba a un cliente ya logueado de vuelta al login.
  useEffect(() => {
    if (!hasHydrated) return
    if (!customer) { router.replace('/cuenta/login'); return }
    fetch(`${API_URL}/api/customer/orders`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { orders?: OrderSummary[]; error?: string }) => {
        if (d.orders) setOrders(d.orders)
        else setError(d.error ?? 'Error al cargar pedidos.')
      })
      .catch(() => setError('No se pudo conectar.'))
      .finally(() => setLoading(false))
  }, [hasHydrated, customer, router])

  if (!hasHydrated || !customer) return null

  return (
    <div style={{ background: 'var(--color-baek-pure)', minHeight: '100vh' }}>
      <section className="px-8 md:px-16 py-12 border-b" style={{ borderColor: 'var(--color-border-editorial)' }}>
        <a href="/cuenta"
          className="font-body text-xs tracking-widest hover:opacity-80 transition-opacity block mb-4"
          style={{ color: 'var(--color-heuk)', opacity: 0.4, letterSpacing: '0.12em' }}>
          ← MI CUENTA
        </a>
        <span className="font-korean text-xs font-medium block mb-2"
          style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em' }}>
          주문 내역
        </span>
        <h1 className="font-headline font-bold" style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', color: 'var(--color-heuk)' }}>
          Mis pedidos
        </h1>
      </section>

      <div className="px-8 md:px-16 py-10 max-w-3xl">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.04)' }} />
            ))}
          </div>
        )}

        {error && (
          <p className="font-body text-sm px-4 py-3"
            style={{ background: 'rgba(215,38,61,0.06)', color: 'var(--color-seoul-red)', borderLeft: '3px solid var(--color-seoul-red)' }}>
            {error}
          </p>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-16">
            <div style={{ opacity: 0.2, margin: '0 auto 12px', width: 'fit-content' }}>
              <Package size={32} color="var(--color-heuk)" />
            </div>
            <p className="font-body text-sm" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
              Aún no tienes pedidos.
            </p>
            <a href="/tienda"
              className="inline-block mt-4 font-body text-xs font-semibold tracking-widest hover:opacity-80 transition-opacity"
              style={{ color: 'var(--color-seoul-red)', letterSpacing: '0.12em' }}>
              IR A LA TIENDA
            </a>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--color-border-editorial)' }}>
            {orders.map(order => (
              <div key={order.id} className="py-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-heuk)' }}>
                    Pedido #{order.number}
                  </p>
                  <p className="font-body text-xs mt-0.5" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
                    {new Date(order.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-body text-xs mt-1 font-semibold" style={{ color: 'var(--color-celadon)' }}>
                    {statusLabel(order.status)}
                  </p>
                  <OrderDetail order={order} />
                </div>
                <p className="font-body font-bold text-sm shrink-0" style={{ color: 'var(--color-heuk)' }}>
                  {formatCLP(order.total)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ShopFooter />
    </div>
  )
}
