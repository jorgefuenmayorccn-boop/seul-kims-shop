'use client'
import { useEffect, useState } from 'react'
import { Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCLP } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface ShiftRow {
  id:             string
  shiftNumber:    number
  deviceId:       string
  status:         'open' | 'closed'
  openedAt:       string
  closedAt:       string | null
  openingFloat:   number
  cashierName:    string
  cashierEmail:   string
  closingSummary: {
    netTotal?:     number
    totalTickets?: number
    totalVoids?:   number
    byMethod?:     Record<string, number>
  } | null
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

export default function TurnosPage() {
  const [shifts,   setShifts]   = useState<ShiftRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch(`${API}/api/shifts/history?limit=30`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { shifts?: ShiftRow[] }) => setShifts(d.shifts ?? []))
      .catch(() => setError('No se pudo cargar el historial'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Clock size={22}/>Turnos</h1>
        <p className="mt-1 text-sm text-text-muted">Historial de turnos y reportes Z maestros</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide w-6" />
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">#</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Cajero</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Apertura</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Duración</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Tickets</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Neto</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-text-muted">Cargando…</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-text-muted">Sin turnos registrados</td></tr>
            ) : shifts.map(shift => {
              const isOpen = expanded === shift.id
              const s = shift.closingSummary
              return (
                <>
                  <tr key={shift.id}
                    className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : shift.id)}>
                    <td className="px-5 py-3.5 text-text-muted">
                      {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-text">#{shift.shiftNumber}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text text-xs">{shift.cashierName}</p>
                      <p className="text-[10px] text-text-muted font-mono">{shift.deviceId}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted font-mono">{fmt(shift.openedAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">{duration(shift.openedAt, shift.closedAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-text">{s?.totalTickets ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-text text-right font-mono">
                      {s?.netTotal != null ? formatCLP(s.netTotal) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${shift.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-surface text-text-muted'}`}>
                        {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </td>
                  </tr>
                  {isOpen && s && (
                    <tr key={`${shift.id}-detail`} className="bg-[var(--color-surface)]">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Resumen</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-text-muted text-xs">Float inicial</span>
                                <span className="font-mono text-xs">{formatCLP(shift.openingFloat)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted text-xs">Anulaciones</span>
                                <span className="font-mono text-xs">{s.totalVoids ?? 0}</span>
                              </div>
                              <div className="flex justify-between border-t border-[var(--color-border)] pt-1 mt-1">
                                <span className="font-semibold text-xs">Neto vendido</span>
                                <span className="font-mono font-bold text-xs">{formatCLP(s.netTotal ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Por método</p>
                            <div className="space-y-1">
                              {Object.entries(s.byMethod ?? {}).filter(([,v]) => v > 0).map(([method, amount]) => (
                                <div key={method} className="flex justify-between">
                                  <span className="text-text-muted text-xs capitalize">{method}</span>
                                  <span className="font-mono text-xs">{formatCLP(amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Tiempo</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-text-muted">Apertura</span>
                                <span className="font-mono">{fmt(shift.openedAt)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Cierre</span>
                                <span className="font-mono">{fmt(shift.closedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
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
