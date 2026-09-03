'use client'
import { useEffect, useState } from 'react'
import { Bike, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCLP } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface DriverShiftRow {
  id:             string
  status:         'open' | 'closed'
  openedAt:       string
  closedAt:       string | null
  driverName:     string
  deliveredCount: number
  byMethod:       Record<string, number>
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo:      'Efectivo',
  transbank:     'Transbank',
  credito_b2b:   'Crédito B2B',
  sin_metodo:    'Sin método registrado',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function duration(from: string, to: string | null) {
  const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export default function TurnosDeliveryPage() {
  const [shifts,   setShifts]   = useState<DriverShiftRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch(`${API}/api/delivery/shifts?limit=30`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { shifts?: DriverShiftRow[] }) => setShifts(d.shifts ?? []))
      .catch(() => setError('No se pudo cargar el historial'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Bike size={22}/>Turnos Delivery</h1>
        <p className="mt-1 text-sm text-text-muted">Repartidores en turno y cuánto cobraron por método de pago</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide w-6" />
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Repartidor</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Apertura</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Duración</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Entregas</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Total cobrado</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-text-muted">Cargando…</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-text-muted">Sin turnos registrados — un repartidor inicia turno desde Drive</td></tr>
            ) : shifts.map(shift => {
              const isOpen = expanded === shift.id
              const total = Object.values(shift.byMethod).reduce((a, b) => a + b, 0)
              return (
                <>
                  <tr key={shift.id}
                    className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : shift.id)}>
                    <td className="px-5 py-3.5 text-text-muted">
                      {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-text text-xs">{shift.driverName}</td>
                    <td className="px-5 py-3.5 text-xs text-text-muted font-mono">{fmt(shift.openedAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">{duration(shift.openedAt, shift.closedAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-text">{shift.deliveredCount}</td>
                    <td className="px-5 py-3.5 text-xs text-text text-right font-mono">{formatCLP(total)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${shift.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-surface text-text-muted'}`}>
                        {shift.status === 'open' ? 'En turno' : 'Cerrado'}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${shift.id}-detail`} className="bg-[var(--color-surface)]">
                      <td colSpan={7} className="px-8 py-4">
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Cobrado por método de pago</p>
                        {Object.keys(shift.byMethod).length === 0 ? (
                          <p className="text-xs text-text-muted">Sin entregas completadas en este turno todavía.</p>
                        ) : (
                          <div className="space-y-1 max-w-xs">
                            {Object.entries(shift.byMethod).map(([method, amount]) => (
                              <div key={method} className="flex justify-between">
                                <span className="text-text-muted text-xs">{PAYMENT_METHOD_LABEL[method] ?? method}</span>
                                <span className="font-mono text-xs">{formatCLP(amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t border-[var(--color-border)] pt-1 mt-1">
                              <span className="font-semibold text-xs">Total</span>
                              <span className="font-mono font-bold text-xs">{formatCLP(total)}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
