'use client'
import { useState, useEffect } from 'react'
import { formatCLP } from '@seul/ui'
import { Truck, User, CheckCircle } from 'lucide-react'

interface Driver {
  id:         string
  name:       string
  activeJobs: number
}

export interface PendingAssign {
  orderId:       string
  assignmentId:  string
  number:        number
  total:         number
  deliveryMode:  string
  paymentAtDoor: boolean
  customerName:  string
  address:       string
}

interface AssignDriverModalProps {
  assignment: PendingAssign
  apiUrl:     string
  onDone:     () => void
}

export function AssignDriverModal({ assignment, apiUrl, onDone }: AssignDriverModalProps) {
  const [drivers,    setDrivers]    = useState<Driver[]>([])
  const [driverId,   setDriverId]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/api/delivery/drivers`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ drivers: Driver[] }>)
      .then(d => setDrivers(d.drivers ?? []))
      .catch(() => {})
  }, [apiUrl])

  async function handleAssign() {
    if (!driverId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/delivery/assignments/${assignment.assignmentId}/assign`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ driverId }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? `Error ${res.status}`)
        return
      }
      setDone(true)
      setTimeout(onDone, 1800)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: 380,
          maxHeight: '90vh',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Truck size={16} color="var(--color-brand)" />
            <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
              Asignar Repartidor
            </p>
          </div>
          <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Pedido #{assignment.number} · {formatCLP(assignment.total)}
          </p>
          {assignment.paymentAtDoor && (
            <p
              className="font-body text-xs mt-1 font-semibold"
              style={{ color: 'var(--color-warning)' }}
            >
              COD — cobrar al entregar
            </p>
          )}
          <p className="font-body text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {assignment.customerName} · {assignment.address}
          </p>
        </div>

        {/* Done state */}
        {done ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle size={40} color="var(--color-success)" />
            <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
              ¡Repartidor asignado!
            </p>
          </div>
        ) : (
          <>
            {/* Driver list */}
            <div className="flex-1 overflow-y-auto py-3">
              {drivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <User size={28} color="var(--color-text-disabled)" />
                  <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No hay repartidores activos
                  </p>
                </div>
              ) : (
                drivers.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDriverId(d.id)}
                    className="w-full flex items-center justify-between px-5 py-3 transition-colors"
                    style={{
                      background: driverId === d.id ? 'var(--color-brand-subtle)' : 'transparent',
                      borderLeft: driverId === d.id ? '3px solid var(--color-brand)' : '3px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{ background: 'var(--color-brand)', color: '#fff' }}
                      >
                        {d.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {d.name}
                      </span>
                    </div>
                    <span
                      className="font-mono text-xs"
                      style={{ color: d.activeJobs > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}
                    >
                      {d.activeJobs > 0 ? `${d.activeJobs} activo${d.activeJobs > 1 ? 's' : ''}` : 'Libre'}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t flex flex-col gap-2 shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {error && (
                <p className="font-body text-xs text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onDone}
                  className="flex-1 py-2.5 rounded-lg text-sm font-body transition-colors"
                  style={{ border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)' }}
                >
                  Asignar después
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!driverId || loading}
                  className="flex-[2] py-2.5 rounded-lg text-sm font-body font-semibold transition-all"
                  style={{
                    background: driverId && !loading ? 'var(--color-brand)' : 'var(--color-border)',
                    color:      driverId && !loading ? '#fff' : 'var(--color-text-disabled)',
                    cursor:     driverId && !loading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? 'Asignando…' : 'Asignar y Marcar Listo'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
