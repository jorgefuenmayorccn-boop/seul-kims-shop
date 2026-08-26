import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, TrendingUp, TrendingDown, MinusCircle, Clock } from 'lucide-react'
import { getCustomerById, getCustomerTimeline } from '@/lib/api'

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const LOYALTY_ICON: Record<string, React.ReactNode> = {
  earn:   <TrendingUp size={13} className="text-green-600" />,
  redeem: <TrendingDown size={13} className="text-brand" />,
  adjust: <MinusCircle size={13} className="text-amber-500" />,
  expire: <Clock size={13} className="text-text-muted" />,
}

const STATUS_COLOR: Record<string, string> = {
  nueva:      'bg-blue-100 text-blue-700',
  preparando: 'bg-amber-100 text-amber-700',
  lista:      'bg-green-100 text-green-700',
  entregada:  'bg-surface text-text-muted',
  cancelada:  'bg-red-100 text-red-600',
}

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [customer, timeline] = await Promise.all([getCustomerById(id), getCustomerTimeline(id)])

  if (!customer) notFound()

  const c = customer
  const loyaltyValueClp = Math.floor((c.loyaltyBalance ?? 0) / 1000) * 1000

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/clientes" className="text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text">{c.name}</h1>
          <p className="text-sm text-text-muted">{c.email ?? c.phone ?? 'Sin contacto'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={14} className="text-text-muted" />
            <span className="text-xs font-medium text-text-muted">Pedidos</span>
          </div>
          <p className="text-2xl font-bold font-mono text-text">{Number(c.orderCount)}</p>
          <p className="text-xs text-text-muted mt-0.5">Total {formatCLP(Number(c.totalSpent))}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-brand" />
            <span className="text-xs font-medium text-text-muted">Puntos lealtad</span>
          </div>
          <p className="text-2xl font-bold font-mono text-brand">{Number(c.loyaltyBalance).toLocaleString('es-CL')}</p>
          <p className="text-xs text-text-muted mt-0.5">≈ {formatCLP(loyaltyValueClp)} en descuentos</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-muted">Identificación</span>
          </div>
          <p className="text-sm font-mono font-medium text-text">{c.rut ?? c.documentNumber ?? '—'}</p>
          <p className="text-xs text-text-muted mt-0.5 capitalize">
            {c.documentType ?? 'RUT'} · canal {c.createdChannel ?? 'web'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Pedidos */}
        <div>
          <h2 className="font-semibold text-text mb-3">Pedidos ({timeline.orders.length})</h2>
          <div className="space-y-2">
            {timeline.orders.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center border border-dashed border-[var(--color-border)] rounded-lg">Sin pedidos</p>
            ) : timeline.orders.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <div>
                  <p className="text-sm font-mono font-bold text-text">#{o.number}</p>
                  <p className="text-xs text-text-muted">{formatDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-text">{formatCLP(Number(o.total))}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[o.status] ?? 'bg-surface text-text-muted'}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loyalty ledger */}
        <div>
          <h2 className="font-semibold text-text mb-3">Lealtad ({timeline.loyalty.length})</h2>
          <div className="space-y-2">
            {timeline.loyalty.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center border border-dashed border-[var(--color-border)] rounded-lg">Sin movimientos</p>
            ) : timeline.loyalty.map(l => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <div className="flex items-center gap-2">
                  {LOYALTY_ICON[l.type] ?? <MinusCircle size={13} />}
                  <div>
                    <p className="text-xs font-medium text-text capitalize">{l.type}</p>
                    <p className="text-[10px] text-text-muted">{l.reason ?? '—'}</p>
                  </div>
                </div>
                <p className={`text-sm font-mono font-bold ${l.points >= 0 ? 'text-green-600' : 'text-error'}`}>
                  {l.points >= 0 ? '+' : ''}{l.points.toLocaleString('es-CL')} pts
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
