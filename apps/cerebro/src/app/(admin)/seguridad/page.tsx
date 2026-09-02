import { Suspense } from 'react'
import { Shield, RotateCcw, AlertTriangle } from 'lucide-react'
import { PinMaestroSection } from './pin-maestro-section'
import { getARCOP, getReturns, getVoidPin } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

async function SeguridadContent() {
  const [arcop, devoluciones, voidPin] = await Promise.all([getARCOP(), getReturns(), getVoidPin()])
  const arcopPendientes = arcop.filter(r => r.status === 'pending')
  const arcopUrgentes   = arcopPendientes.filter(r => {
    if (!r.deadline) return false
    return Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000) <= 3
  })

  return (
    <div className="space-y-8">
      {arcopUrgentes.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-error bg-error-subtle p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error" />
          <div>
            <p className="font-semibold text-error">{arcopUrgentes.length} solicitud{arcopUrgentes.length > 1 ? 'es' : ''} ARCOP por vencer</p>
            <p className="mt-0.5 text-sm text-text-muted">Ley 21.719 exige respuesta en 15 días hábiles.</p>
          </div>
        </div>
      )}

      {/* PIN Maestro POS */}
      <PinMaestroSection currentPin={voidPin} apiUrl={API} />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="size-5 text-brand" />
          <h2 className="text-lg font-semibold text-text">Solicitudes ARCOP</h2>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{arcopPendientes.length} pendiente{arcopPendientes.length !== 1 ? 's' : ''}</span>
        </div>
        {arcop.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-text-muted">Sin solicitudes ARCOP registradas</p>
        ) : (
          <div className="space-y-2">
            {arcop.map(r => (
              <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text">{r.notes}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  {r.deadline && (
                    <span className="text-xs font-mono text-text-muted">Plazo: {new Date(r.deadline).toLocaleDateString('es-CL')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <RotateCcw className="size-5 text-brand" />
          <h2 className="text-lg font-semibold text-text">Devoluciones en curso</h2>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{devoluciones.length}</span>
        </div>
        {devoluciones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-text-muted">Sin devoluciones pendientes</p>
        ) : (
          <div className="space-y-2">
            {devoluciones.map(r => (
              <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-surface p-4">
                <p className="text-xs text-text-muted mb-1">Pedido #{r.orderId.slice(0, 8)}… · {r.type}</p>
                <p className="text-sm text-text">{r.reason}</p>
                <p className="mt-1 text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString('es-CL')}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function SeguridadPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Seguridad y Privacidad</h1>
        <p className="mt-1 text-sm text-text-muted">ARCOP (Ley 21.719) · Devoluciones · PIN POS · Cumplimiento legal</p>
      </div>
      <Suspense fallback={<div className="text-center py-16 text-sm text-text-muted">Cargando…</div>}>
        <SeguridadContent />
      </Suspense>
    </div>
  )
}
