// SEUL KING OS — Dashboard principal
// Fase 1: KPIs + alertas inventario + actividad reciente
export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-6">
      <h1 className="font-headline text-3xl font-bold text-text mb-2">
        SEUL KING OS
      </h1>
      <p className="text-text-muted mb-8">Panel de control · Seoul Kims</p>

      {/* Fase 1 — aquí irán los KPICards, AlertBanner, tabla actividad */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-elevated rounded-lg p-5 shadow-sm border border-[var(--color-border)]">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Ventas hoy</p>
          <p className="font-mono text-2xl font-bold text-text">—</p>
        </div>
        <div className="bg-elevated rounded-lg p-5 shadow-sm border border-[var(--color-border)]">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Pedidos activos</p>
          <p className="font-mono text-2xl font-bold text-text">—</p>
        </div>
        <div className="bg-elevated rounded-lg p-5 shadow-sm border border-[var(--color-border)]">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Vencen esta semana</p>
          <p className="font-mono text-2xl font-bold text-expiry-urgent">—</p>
        </div>
        <div className="bg-elevated rounded-lg p-5 shadow-sm border border-[var(--color-border)]">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Stock crítico</p>
          <p className="font-mono text-2xl font-bold text-warning">—</p>
        </div>
      </div>
    </main>
  )
}
