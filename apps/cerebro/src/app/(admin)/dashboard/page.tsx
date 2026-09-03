import { Suspense } from 'react'
import { getDashboardStats, getDashboardAlerts } from '@/lib/api'
import { KPICard, AlertBanner, EmptyState, SkeletonDashboard, formatCLP } from '@seul/ui'
import { RefreshCw } from 'lucide-react'
import { ProductsTable } from '@/components/cerebro/products-table'
import { RecentOrdersTable } from '@/components/cerebro/recent-orders-table'

export const revalidate = 60

async function DashboardContent() {
  const [stats, alerts] = await Promise.all([getDashboardStats(), getDashboardAlerts()])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-xs text-text-muted font-mono mt-0.5">
            SEUL KING OS V1.0 · Viña del Mar ·{' '}
            {stats.generatedAt ? new Date(stats.generatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
        <form action="/dashboard">
          <button type="submit" className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded-md hover:bg-surface">
            <RefreshCw size={12} /> Actualizar
          </button>
        </form>
      </div>

      {'apiOffline' in stats && stats.apiOffline && (
        <AlertBanner severity="critical"
          title="API no disponible — datos desactualizados"
          description="No se pudo conectar con el servidor. Verifica que la API esté corriendo en http://localhost:8787" />
      )}

      {alerts.dtesFallidos.length > 0 && (
        <div className="space-y-2">
          {alerts.dtesFallidos.map(d => (
            <AlertBanner key={d.id} severity="critical"
              title={`Boleta #${d.number} sin emitir — error SII`}
              description="El sistema reintentará automáticamente. Si persiste, revisar en Ajustes › DTE." />
          ))}
        </div>
      )}

      {alerts.vencidos.length > 0 && (
        <AlertBanner severity="critical"
          title={`${alerts.vencidos.length} producto${alerts.vencidos.length > 1 ? 's' : ''} VENCIDO${alerts.vencidos.length > 1 ? 'S' : ''} en góndola`}
          description={`Retirar inmediatamente: ${alerts.vencidos.map(v => v.name).join(', ')}`} />
      )}

      {alerts.urgentes.length > 0 && alerts.vencidos.length === 0 && (
        <AlertBanner severity="warning"
          title={`${alerts.urgentes.length} lote${alerts.urgentes.length > 1 ? 's' : ''} vencen en menos de 3 días`}
          description={alerts.urgentes.map(u => u.name).join(', ')} />
      )}

      <section>
        <h2 className="font-headline text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Hoy</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KPICard label="Ventas hoy" value={stats.ventasHoy} format="clp" delta={stats.deltaVentas} variant={stats.ventasHoy === 0 ? 'default' : 'success'} />
          <KPICard label="Ticket promedio" value={stats.ticketPromedio} format="clp" variant="default" />
          <KPICard label="Pedidos activos" value={stats.pedidosActivos} format="number" variant={stats.pedidosActivos > 10 ? 'warning' : 'default'} />
          <KPICard label="Web sin despachar" value={stats.pedidosWebSinDespachar} format="number" variant={stats.pedidosWebSinDespachar > 5 ? 'urgent' : 'default'} />
        </div>
      </section>

      <section>
        <h2 className="font-headline text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Alertas de inventario</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KPICard label="Vencen esta semana" value={stats.vencenEstaSemana} format="number" variant={stats.vencenEstaSemana > 0 ? 'warning' : 'success'} />
          <KPICard label="Stock crítico" value={stats.stockCritico} format="number" variant={stats.stockCritico > 0 ? 'warning' : 'success'} />
          <KPICard label="B2B sin cobrar" value={stats.b2bPendientes} format="number" variant={stats.b2bPendientes > 0 ? 'warning' : 'default'} />
          <KPICard label="DTE fallidos" value={alerts.dtesFallidos.length} format="number" variant={alerts.dtesFallidos.length > 0 ? 'urgent' : 'success'} />
        </div>
      </section>

      <section>
        <h2 className="font-headline text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Catálogo activo</h2>
        <Suspense fallback={<div className="h-40 bg-surface rounded-lg animate-pulse" />}>
          <ProductsTable />
        </Suspense>
      </section>

      <section>
        <h2 className="font-headline text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Últimos pedidos</h2>
        <Suspense fallback={<div className="h-40 bg-surface rounded-lg animate-pulse" />}>
          <RecentOrdersTable />
        </Suspense>
      </section>

      <section>
        <h2 className="font-headline text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Top productos hoy</h2>
        {stats.top5Productos.length === 0 ? (
          <EmptyState variant="no-orders" />
        ) : (
          <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-surface">
                  <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">#</th>
                  <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Unidades</th>
                  <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {stats.top5Productos.map((p, i) => (
                  <tr key={p.productId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-surface transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">{i + 1}</td>
                    <td className="px-4 py-3 font-body text-sm text-text font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{Number(p.units).toLocaleString('es-CL')}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-success">{formatCLP(Number(p.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<SkeletonDashboard />}>
      <DashboardContent />
    </Suspense>
  )
}
