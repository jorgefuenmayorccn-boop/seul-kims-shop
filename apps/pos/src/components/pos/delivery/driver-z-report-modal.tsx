'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface ZReport {
  driver:          { id: string; name: string; email: string }
  periodFrom:      string
  periodTo:        string
  deliveriesCount: number
  totalKm:         number
  grossClp:        number
  cashCollected:   number
  netPayable:      number
}

interface DriverZReportModalProps {
  driverId:   string
  driverName: string
  onClose:    () => void
}

function clp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export function DriverZReportModal({ driverId, driverName, onClose }: DriverZReportModalProps) {
  const [report,      setReport]     = useState<ZReport | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [liquidating, setLiquidating] = useState(false)
  const [done,        setDone]       = useState(false)
  const [error,       setError]      = useState('')

  useEffect(() => {
    fetch(`${API}/api/delivery/drivers/${driverId}/z-report`, { credentials: 'include' })
      .then(r => r.json() as Promise<ZReport>)
      .then(d => setReport(d))
      .catch(() => setError('No se pudo cargar el reporte'))
      .finally(() => setLoading(false))
  }, [driverId])

  async function handleLiquidar() {
    if (!report) return
    setLiquidating(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/delivery/payouts`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          periodFrom:      report.periodFrom,
          periodTo:        report.periodTo,
          deliveriesCount: report.deliveriesCount,
          totalKm:         report.totalKm,
          grossClp:        report.grossClp,
          cashCollected:   report.cashCollected,
          netPayable:      report.netPayable,
        }),
      })
      if (!res.ok) throw new Error('Error al registrar liquidación')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLiquidating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="flex flex-col w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-elevated)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
              Z-Report Repartidor
            </p>
            <p className="font-body text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {driverName}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:opacity-70">
            <X size={16} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
            </div>
          ) : done ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle2 size={40} style={{ color: 'var(--color-baes-eligible)' }} />
              <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Liquidación registrada</p>
              <p className="font-body text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                Se registró el pago de {report ? clp(Math.abs(report.netPayable)) : ''} al repartidor.
              </p>
            </div>
          ) : report ? (
            <div className="space-y-3">
              <Row label="Entregas" value={String(report.deliveriesCount)} />
              <Row label="Distancia total" value={`${Number(report.totalKm).toFixed(1)} km`} />
              <Row label="Tarifa" value="$1.000 / km" />
              <div className="border-t pt-3 mt-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                <Row label="Bruto ($1k × km)" value={clp(report.grossClp)} />
                <Row label="Efectivo recibido" value={`− ${clp(report.cashCollected)}`} />
                <div
                  className="flex justify-between items-center px-3 py-2 rounded-lg"
                  style={{ background: report.netPayable >= 0 ? 'var(--color-success-subtle, #f0fdf4)' : 'var(--color-error-subtle)' }}
                >
                  <span className="font-body text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    {report.netPayable >= 0 ? 'A pagar al repartidor' : 'A cobrar al repartidor'}
                  </span>
                  <span
                    className="font-mono font-bold text-base"
                    style={{ color: report.netPayable >= 0 ? 'var(--color-baes-eligible)' : 'var(--color-error)' }}
                  >
                    {clp(Math.abs(report.netPayable))}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="font-body text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
              Sin entregas en el período actual.
            </p>
          )}

          {error && (
            <p className="mt-3 font-body text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        {!done && !loading && (
          <div className="px-5 pb-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-body text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Cerrar
            </button>
            {report && report.deliveriesCount > 0 && (
              <button
                onClick={handleLiquidar}
                disabled={liquidating}
                className="flex-[2] py-2.5 rounded-lg font-headline font-bold text-sm disabled:opacity-50"
                style={{ background: 'var(--heuk-950, #0a0a0a)', color: '#f5f5f2' }}
              >
                {liquidating ? 'Registrando…' : 'Liquidar turno'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}
