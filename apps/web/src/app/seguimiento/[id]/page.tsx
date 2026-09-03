'use client'
import { useEffect, useState } from 'react'
import { Package, CheckCircle2, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// Seguimiento SIN login (adición post-entrega, 3-sep-2026) — para el
// cliente "fantasma" (guest checkout) que nunca puso contraseña, sin forma
// de entrar a /cuenta/pedidos. El [id] de la URL es el UUID del pedido —
// no hace falta autenticación, ver GET /api/public/orders/:id/track para
// el criterio de seguridad (mismo que un link público de un solo recurso).
interface OrderTrack {
  id: string; number: number; total: string; status: string; dteStatus: string
  channel: string; createdAt: string; paymentStatus: string | null; paymentMethod: string | null
  deliveryMode: string | null; metroStation: string | null; metroSlot: string | null
  deliveryDate: string | null; readyAt: string | null
  deliveryStatus: string | null; driverName: string | null; customerName: string | null
}

function formatCLP(v: string | number) { return `$${Number(v).toLocaleString('es-CL')}` }

const STATUS_LABEL: Record<string, string> = {
  nueva: 'Recibido', preparando: 'Preparando', lista: 'Listo',
  en_ruta: 'En camino', entregada: 'Entregado', cancelada: 'Cancelado',
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

export default function SeguimientoPage({ params }: { params: { id: string } }) {
  const [order, setOrder]     = useState<OrderTrack | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/public/orders/${params.id}/track`)
      .then(r => r.json())
      .then((d: { order?: OrderTrack; error?: string }) => {
        if (d.order) setOrder(d.order)
        else setError(d.error ?? 'No se pudo cargar el pedido.')
      })
      .catch(() => setError('No se pudo conectar.'))
      .finally(() => setLoading(false))
  }, [params.id])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-baek-pure, #f5f5f2)' }}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface, #fff)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <a href="/">
            <p className="font-korean font-black text-2xl" style={{ color: 'var(--color-seoul-red, #d7263d)' }}>서울킴스</p>
          </a>
          <p className="text-xs text-[var(--color-text-secondary,#888)] mt-1">Seguimiento de pedido</p>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin" style={{ color: 'var(--color-seoul-red, #d7263d)' }} />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-center px-4 py-3 rounded-lg" style={{ background: 'rgba(215,38,61,0.06)', color: 'var(--color-seoul-red, #d7263d)' }}>
            {error}
          </p>
        )}

        {order && !loading && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package size={18} style={{ color: 'var(--color-seoul-red, #d7263d)' }} />
                <p className="font-bold text-lg">Pedido #{order.number}</p>
              </div>
              <p className="font-mono font-bold">{formatCLP(order.total)}</p>
            </div>

            <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--color-surface-sunken, #f5f5f2)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-secondary,#888)' }}>Estado</p>
              <p className="font-semibold" style={{ color: 'var(--color-celadon, #6b8f71)' }}>
                {STATUS_LABEL[order.status] ?? order.status}
              </p>
            </div>

            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary, #666)' }}>
              {order.deliveryMode && (
                <p>{DELIVERY_MODE_LABEL[order.deliveryMode] ?? order.deliveryMode}</p>
              )}
              {order.deliveryMode === 'metro' && order.metroStation && (
                <p>
                  Estación {order.metroStation}
                  {order.deliveryDate ? ` · ${formatDeliveryDate(order.deliveryDate)}` : ''}
                  {order.metroSlot ? ` · ${order.metroSlot}` : ''}
                </p>
              )}
              {order.readyAt && (
                <p className="font-semibold flex items-center gap-1" style={{ color: 'var(--color-celadon, #6b8f71)' }}>
                  <CheckCircle2 size={14} /> Listo para retirar
                </p>
              )}
              {order.deliveryStatus && (
                <p>
                  {DELIVERY_STATUS_LABEL[order.deliveryStatus] ?? order.deliveryStatus}
                  {order.driverName && order.deliveryStatus !== 'pending' ? ` · ${order.driverName}` : ''}
                </p>
              )}
              {order.paymentStatus === 'pending' ? (
                <p className="font-semibold" style={{ color: 'var(--color-seoul-red, #d7263d)' }}>
                  Pago pendiente — revisa tu correo para completarlo
                </p>
              ) : order.paymentMethod && (
                <p>Pago: {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary,#888)' }}>
                ¿Querés ver todos tus pedidos en un solo lugar?
              </p>
              <a href="/cuenta/registro"
                className="inline-block text-xs font-semibold tracking-widest px-4 py-2 rounded-lg"
                style={{ background: 'var(--color-seoul-red, #d7263d)', color: '#fff' }}>
                CREAR CUENTA
              </a>
            </div>
          </div>
        )}

        <p className="text-[10px] text-center mt-6 opacity-40" style={{ color: 'var(--color-text-secondary,#888)' }}>
          Seoul King OS V2.0 · Creado por VÉRTICE Productions · verticeproductions.com
        </p>
      </div>
    </div>
  )
}
