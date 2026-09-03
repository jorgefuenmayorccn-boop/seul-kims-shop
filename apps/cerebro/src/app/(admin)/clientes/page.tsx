import { Search, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { getCustomers as fetchCustomers } from '@/lib/api'

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

const CHANNEL_LABEL: Record<string, string> = {
  web: 'Web', pos: 'POS', b2b: 'B2B', import: 'Import',
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const { customers } = await fetchCustomers({ q, limit: 100 })

  const totalSpent = customers.reduce((s, c) => s + Number(c.totalSpent), 0)
  const totalOrders = customers.reduce((s, c) => s + Number(c.orderCount), 0)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Clientes</h1>
          <p className="mt-1 text-sm text-text-muted">
            {customers.length} registros · {totalOrders} pedidos · {formatCLP(totalSpent)} total
          </p>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o RUT…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Cliente</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Canal</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Pedidos</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Total</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Puntos</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-text-muted">
                  {q ? 'Sin resultados para esa búsqueda' : 'Sin clientes registrados'}
                </td>
              </tr>
            ) : customers.map(c => (
              <tr key={c.id} className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors">
                <td className="px-5 py-3.5">
                  <Link href={`/clientes/${c.id}`} className="hover:text-brand transition-colors">
                    <p className="font-medium text-text">{c.name}</p>
                    <p className="text-xs text-text-muted font-mono">{c.email ?? c.phone ?? '—'}</p>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                    {CHANNEL_LABEL[c.createdChannel ?? ''] ?? c.createdChannel ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-sm text-text">{Number(c.orderCount)}</td>
                <td className="px-5 py-3.5 text-right font-mono text-sm text-text">{formatCLP(Number(c.totalSpent))}</td>
                <td className="px-5 py-3.5 text-right">
                  {Number(c.loyaltyBalance) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                      <TrendingUp size={11} />
                      {Number(c.loyaltyBalance).toLocaleString('es-CL')} pts
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-text-muted font-mono">
                  {new Date(c.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
