'use client'
import { useState, useEffect } from 'react'
import { Bike, MapPin, Phone, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { printComanda } from '@/lib/print-service'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface Driver {
  id:         string
  name:       string
  email:      string
  activeJobs: number
}

interface DispatchPanelProps {
  orderId:        string
  orderNumber:    number
  assignmentId:   string | null
  customerName:   string | null
  customerPhone:  string | null
  deliveryAddress:string | null
  commune:        string | null
  amountToCollect:number
  paymentAtDoor:  boolean
  onAssigned:     () => void
  onClose:        () => void
}

function clp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export function DispatchPanel({
  orderId, orderNumber, assignmentId,
  customerName, customerPhone, deliveryAddress, commune,
  amountToCollect, paymentAtDoor,
  onAssigned, onClose,
}: DispatchPanelProps) {
  const [drivers,    setDrivers]    = useState<Driver[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [assigning,  setAssigning]  = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch(`${API}/api/delivery/drivers`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ drivers: Driver[] }>)
      .then(d => setDrivers(d.drivers ?? []))
      .catch(() => {})
  }, [])

  async function handleAssign() {
    if (!selected || !assignmentId) return
    setAssigning(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/delivery/assignments/${assignmentId}/assign`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ driverId: selected }),
      })
      if (!res.ok) throw new Error('Error al asignar')
      setDone(true)
      // Print delivery comanda
      const orderRes = await fetch(`${API}/api/orders/${orderId}`, { credentials: 'include' }).catch(() => null)
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
      setTimeout(onAssigned, 1200)
    } catch {
      setError('No se pudo asignar el repartidor. Intenta de nuevo.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="flex flex-col w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-elevated)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
              Asignar repartidor
            </p>
            <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Pedido #{String(orderNumber).padStart(6, '0')}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:opacity-70">
            <X size={16} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Cliente y dirección */}
        <div className="px-5 py-3 border-b space-y-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {customerName && (
            <div className="flex items-center gap-2">
              <Phone size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span className="font-body text-sm" style={{ color: 'var(--color-text)' }}>
                {customerName}{customerPhone ? ` · ${customerPhone}` : ''}
              </span>
            </div>
          )}
          {deliveryAddress && (
            <div className="flex items-center gap-2">
              <MapPin size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span className="font-body text-sm" style={{ color: 'var(--color-text)' }}>
                {deliveryAddress}{commune ? `, ${commune}` : ''}
              </span>
            </div>
          )}
          {paymentAtDoor && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-semibold"
              style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
            >
              <Bike size={11} />
              Cobrar {clp(amountToCollect)} en puerta
            </div>
          )}
        </div>

        {/* Lista de repartidores */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
          {done ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <CheckCircle2 size={40} style={{ color: 'var(--color-dte-issued, #16a34a)' }} />
              <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Repartidor notificado
              </p>
            </div>
          ) : drivers.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
              <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Sin repartidores disponibles
              </p>
              <p className="font-body text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Agrega usuarios con rol «Delivery» en el Cerebro
              </p>
            </div>
          ) : (
            drivers.map(d => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className="w-full text-left px-5 py-3.5 border-b flex items-center justify-between gap-3 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  background:  selected === d.id ? 'var(--color-brand-subtle, rgba(215,38,61,0.05))' : 'transparent',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-headline font-bold text-sm"
                    style={{
                      background: selected === d.id ? 'var(--color-brand)' : 'var(--color-surface)',
                      color:      selected === d.id ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {d.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{d.name}</p>
                    <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {Number(d.activeJobs) > 0 ? `${d.activeJobs} entrega${Number(d.activeJobs) !== 1 ? 's' : ''} activa${Number(d.activeJobs) !== 1 ? 's' : ''}` : 'Disponible'}
                    </p>
                  </div>
                </div>
                {selected === d.id && (
                  <CheckCircle2 size={18} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
            {error && <p className="font-body text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg font-body text-sm transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Más tarde
              </button>
              <button
                onClick={handleAssign}
                disabled={!selected || assigning || !assignmentId}
                className="flex-1 py-2.5 rounded-lg font-headline font-bold text-sm transition-all"
                style={{
                  background: (!selected || assigning || !assignmentId) ? 'var(--color-border)' : 'var(--heuk-950, #0a0a0a)',
                  color:      (!selected || assigning || !assignmentId) ? 'var(--color-text-muted)' : '#f5f5f2',
                }}
              >
                {assigning ? 'Asignando…' : 'Despachar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
