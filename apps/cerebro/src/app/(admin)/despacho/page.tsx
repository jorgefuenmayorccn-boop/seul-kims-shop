'use client'
import { useEffect, useState } from 'react'
import { Truck, Train, MapPin, CheckCircle, Clock, AlertCircle, User } from 'lucide-react'
import { friendlyErrorMessage, EmptyState } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type AssignmentStatus = 'pending' | 'assigned' | 'accepted' | 'in_transit' | 'delivered' | 'failed'

interface Assignment {
  id:              string
  orderId:         string
  driverId:        string | null
  status:          AssignmentStatus
  amountToCollect: number | null
  paymentAtDoor:   string
  routeIndex:      number | null
  assignedAt:      string | null
  deliveredAt:     string | null
  createdAt:       string
  orderNumber:     number
  orderTotal:      string
  deliveryMode:    string
  deliveryAddress: string | null
  metroStation:    string | null
  metroSlot:       string | null
  customerName:    string | null
  customerPhone:   string | null
}

interface Driver { id: string; name: string; role: string }

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending:    'Sin asignar',
  assigned:   'Asignado',
  accepted:   'Aceptado',
  in_transit: 'En camino',
  delivered:  'Entregado',
  failed:     'Fallido',
}

const STATUS_COLOR: Record<AssignmentStatus, string> = {
  pending:    'bg-amber-100 text-amber-700',
  assigned:   'bg-blue-100 text-blue-700',
  accepted:   'bg-blue-100 text-blue-800',
  in_transit: 'bg-brand/10 text-brand',
  delivered:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default function DespachoPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [drivers,     setDrivers]     = useState<Driver[]>([])
  const [loading,     setLoading]     = useState(true)
  const [assigning,   setAssigning]   = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [aRes, uRes] = await Promise.all([
        fetch(`${API}/api/delivery/assignments`, { credentials: 'include' }),
        fetch(`${API}/api/auth/users`, { credentials: 'include' }),
      ])
      if (!aRes.ok || !uRes.ok) throw new Error('Error al cargar datos')
      const aData = await aRes.json() as { assignments: Assignment[] }
      const uData = await uRes.json() as { users: Driver[] }
      setAssignments(aData.assignments ?? [])
      setDrivers((uData.users ?? []).filter(u => u.role === 'delivery' || u.role === 'staff'))
    } catch (err) {
      console.error('[cerebro/despacho]', err)
      setError(friendlyErrorMessage(err instanceof Error ? err.message : undefined, 'Error de conexión'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function assignDriver(assignmentId: string, driverId: string) {
    setAssigning(assignmentId)
    try {
      const r = await fetch(`${API}/api/delivery/assignments/${assignmentId}/assign`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ driverId }),
      })
      if (!r.ok) {
        const d = await r.json() as { error?: string }
        setError(d.error ?? 'Error al asignar repartidor')
      } else {
        load()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setAssigning(null)
    }
  }

  const active    = assignments.filter(a => !['delivered', 'failed'].includes(a.status))
  const completed = assignments.filter(a => ['delivered', 'failed'].includes(a.status))

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <p className="text-sm text-text-muted">Cargando despachos…</p>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Despacho</h1>
          <p className="mt-1 text-sm text-text-muted">
            {active.length} activos · {completed.filter(a => a.status === 'delivered').length} entregados hoy
          </p>
        </div>
        <button onClick={load} className="text-sm text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded border border-[var(--color-border)]">
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-subtle border border-error text-sm text-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-error hover:opacity-70">✕</button>
        </div>
      )}

      {/* Activos */}
      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] mb-6">
          <EmptyState variant="no-orders" title="Sin despachos activos" description="Las entregas asignadas aparecerán aquí." />
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {active.map(a => (
            <div key={a.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {a.deliveryMode === 'metro'
                    ? <Train size={18} className="text-blue-600 mt-0.5 shrink-0" />
                    : <Truck  size={18} className="text-orange-500 mt-0.5 shrink-0" />
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text font-mono">#{a.orderNumber}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-0.5">{a.customerName ?? 'Cliente sin nombre'}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                      <MapPin size={11} />
                      {a.deliveryMode === 'metro'
                        ? `Estación ${a.metroStation} · ${a.metroSlot ?? '—'}`
                        : a.deliveryAddress ?? 'Sin dirección'
                      }
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-sm text-text">{formatCLP(Number(a.orderTotal))}</p>
                  {a.amountToCollect && Number(a.amountToCollect) > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">Cobrar en puerta</p>
                  )}
                </div>
              </div>

              {/* Asignar repartidor */}
              {a.status === 'pending' && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[var(--color-border)]">
                  <User size={14} className="text-text-muted shrink-0" />
                  <select
                    className="flex-1 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                    defaultValue=""
                    onChange={e => e.target.value && assignDriver(a.id, e.target.value)}
                    disabled={assigning === a.id}
                  >
                    <option value="" disabled>Asignar repartidor…</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {assigning === a.id && <span className="text-xs text-text-muted">Guardando…</span>}
                </div>
              )}

              {a.status !== 'pending' && a.driverId && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                  <User size={11} />
                  {drivers.find(d => d.id === a.driverId)?.name ?? 'Repartidor'}
                  {a.status === 'in_transit' && <span className="text-brand font-medium">· En camino</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completados (colapsado) */}
      {completed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-text-muted hover:text-text flex items-center gap-2 mb-3">
            <CheckCircle size={14} />
            Historial ({completed.length})
          </summary>
          <div className="space-y-2">
            {completed.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 opacity-70">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <p className="text-sm font-mono text-text">#{a.orderNumber} · {a.customerName ?? '—'}</p>
                </div>
                <p className="text-xs font-mono text-text-muted">
                  {a.deliveredAt ? new Date(a.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
