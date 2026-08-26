'use client'
import { useState, useEffect } from 'react'
import { RappiDispatchModal } from './rappi-dispatch-modal'
import { printComanda } from '@/lib/print-service'

interface Driver {
  id:         string
  name:       string
  activeJobs: number
}

interface DispatchBifurcationPanelProps {
  orderId:         string
  orderNumber:     number
  deliveryMode:    string
  amountToCollect: number
  apiUrl:          string
  onDispatched:    () => void
}

export function DispatchBifurcationPanel({
  orderId, orderNumber, deliveryMode, amountToCollect, apiUrl, onDispatched,
}: DispatchBifurcationPanelProps) {
  const [drivers,       setDrivers]       = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [assigning,     setAssigning]     = useState(false)
  const [showRappi,     setShowRappi]     = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/api/delivery/drivers`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { drivers: Driver[] }) => setDrivers(d.drivers ?? []))
      .catch(() => {})
  }, [apiUrl])

  async function assignInternal() {
    if (!selectedDriver) return
    setAssigning(true)
    setError('')
    try {
      const assignRes = await fetch(`${apiUrl}/api/delivery/assignments`, {
        credentials: 'include',
      })
      const assignData = await assignRes.json() as { assignments: Array<{ id: string; orderId: string }> }
      const assignment = assignData.assignments.find(a => a.orderId === orderId)
      if (!assignment) throw new Error('No se encontró la asignación del pedido')

      const res = await fetch(`${apiUrl}/api/delivery/assignments/${assignment.id}/assign`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ driverId: selectedDriver }),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      // Print delivery comanda
      const orderRes = await fetch(`${apiUrl}/api/orders/${orderId}`, { credentials: 'include' }).catch(() => null)
      if (orderRes?.ok) {
        const od = await orderRes.json() as { order?: { items?: Array<{ productName: string; qty?: number; quantity?: number }> } }
        await printComanda({
          orderId,
          number:       orderNumber,
          channel:      'pos',
          createdAt:    new Date().toISOString(),
          items:        (od.order?.items ?? []).map(i => ({ name: i.productName, qty: i.qty ?? i.quantity ?? 1 })),
          deliveryMode: 'shipping',
        }).catch(() => {})
      }
      onDispatched()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar')
    } finally {
      setAssigning(false)
    }
  }

  const showInternalOption = deliveryMode === 'delivery'
  const showRappiOption    = deliveryMode === 'rappi' || deliveryMode === 'delivery'

  return (
    <>
      <div className="space-y-4">
        {showInternalOption && (
          <div
            className="rounded p-4 space-y-3"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="font-body text-xs font-semibold" style={{ color: 'var(--color-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Flota Interna
            </p>
            {drivers.length === 0 ? (
              <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Sin repartidores disponibles
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  {drivers.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDriver(d.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded text-left transition-all"
                      style={{
                        border:     `1px solid ${selectedDriver === d.id ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: selectedDriver === d.id ? 'var(--color-brand-subtle)' : 'transparent',
                      }}
                    >
                      <span className="font-body text-sm" style={{ color: 'var(--color-text)' }}>{d.name}</span>
                      <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {d.activeJobs > 0 ? `${d.activeJobs} activo${d.activeJobs > 1 ? 's' : ''}` : 'Disponible'}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={assignInternal}
                  disabled={!selectedDriver || assigning}
                  className="w-full font-headline font-bold text-sm py-2.5 rounded transition-all"
                  style={{
                    background: selectedDriver && !assigning ? 'var(--color-text)' : 'var(--color-border)',
                    color:      selectedDriver && !assigning ? 'var(--color-surface-elevated)' : 'var(--color-text-disabled)',
                    cursor:     selectedDriver && !assigning ? 'pointer' : 'not-allowed',
                  }}
                >
                  {assigning ? 'Asignando...' : 'Asignar repartidor'}
                </button>
              </>
            )}
          </div>
        )}

        {showRappiOption && (
          <div
            className="rounded p-4"
            style={{ border: '1px solid var(--color-channel-rappi, #FF441F)', background: 'rgba(255,68,31,0.04)' }}
          >
            <p className="font-body text-xs font-semibold mb-2" style={{ color: 'var(--color-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Despacho Rappi
            </p>
            <p className="font-body text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Ingrese los datos del Rappitendero que retiró el pedido.
            </p>
            <button
              onClick={() => setShowRappi(true)}
              className="w-full font-headline font-bold text-sm py-2.5 rounded transition-all hover:opacity-90"
              style={{ background: '#FF441F', color: '#fff' }}
            >
              Confirmar datos Rappi
            </button>
          </div>
        )}

        {error && (
          <p className="font-body text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
      </div>

      {showRappi && (
        <RappiDispatchModal
          orderId={orderId}
          orderNumber={orderNumber}
          amountToCollect={amountToCollect}
          apiUrl={apiUrl}
          onConfirm={() => { setShowRappi(false); onDispatched() }}
          onClose={() => setShowRappi(false)}
        />
      )}
    </>
  )
}
