'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore } from '@/lib/customer-store'
import { ShopFooter } from '@seul/ui/shop/shop-footer'
import { Package } from '@seul/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface OrderSummary {
  id:        string
  number:    number
  total:     string
  status:    string
  dteStatus: string
  channel:   string
  createdAt: string
}

function formatCLP(v: string | number) {
  return `$${Number(v).toLocaleString('es-CL')}`
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending:    'Pendiente',
    confirmed:  'Confirmado',
    preparing:  'Preparando',
    ready:      'Listo',
    delivering: 'En camino',
    delivered:  'Entregado',
    cancelled:  'Cancelado',
  }
  return map[s] ?? s
}

export default function PedidosPage() {
  const { customer } = useCustomerStore()
  const router = useRouter()
  const [orders, setOrders]     = useState<OrderSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!customer) { router.replace('/cuenta/login'); return }
    fetch(`${API_URL}/api/customer/orders`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { orders?: OrderSummary[]; error?: string }) => {
        if (d.orders) setOrders(d.orders)
        else setError(d.error ?? 'Error al cargar pedidos.')
      })
      .catch(() => setError('No se pudo conectar.'))
      .finally(() => setLoading(false))
  }, [customer, router])

  if (!customer) return null

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
                <div>
                  <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-heuk)' }}>
                    Pedido #{order.number}
                  </p>
                  <p className="font-body text-xs mt-0.5" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
                    {new Date(order.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-body text-xs mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
                    {statusLabel(order.status)}
                  </p>
                </div>
                <p className="font-body font-bold text-sm" style={{ color: 'var(--color-heuk)' }}>
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
