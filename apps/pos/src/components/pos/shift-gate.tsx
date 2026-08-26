'use client'
import { useState } from 'react'
import { formatCLP } from '@seul/ui'
import type { ActiveShift } from '@/lib/shift-store'

interface ShiftGateProps {
  cashierName: string
  apiUrl:      string
  deviceId:    string
  onShiftOpen: (shift: ActiveShift) => void
}

export function ShiftGate({ cashierName, apiUrl, deviceId, onShiftOpen }: ShiftGateProps) {
  const [float,   setFloat]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const floatNum = parseInt(float.replace(/\D/g, ''), 10) || 0

  async function handleOpen() {
    if (floatNum < 0) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${apiUrl}/api/shifts/open`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          device_id:         deviceId,
          opening_float_clp: floatNum,
        }),
      })

      const data = await res.json() as { shift?: ActiveShift; error?: string }

      if (!res.ok) {
        const msg = data.error ?? ''
        const alreadyOpen = msg.toLowerCase().includes('abierta') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('open')
        if (alreadyOpen) {
          const activeRes = await fetch(`${apiUrl}/api/shifts/active?device_id=${deviceId}`, { credentials: 'include' })
          if (activeRes.ok) {
            const activeData = await activeRes.json() as { shift?: ActiveShift }
            if (activeData.shift) { onShiftOpen(activeData.shift); return }
          }
        }
        setError(msg || 'No se pudo abrir el turno')
        return
      }

      if (data.shift) {
        onShiftOpen({
          id:           data.shift.id,
          shiftNumber:  data.shift.shiftNumber,
          openedAt:     data.shift.openedAt,
          openingFloat: data.shift.openingFloat,
          deviceId:     data.shift.deviceId,
        })
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--color-background)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl shadow-lg overflow-hidden"
        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="px-8 py-6 border-b text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="font-korean font-black text-2xl mb-1" style={{ color: 'var(--color-brand)' }}>
            서울킴스
          </p>
          <p className="font-headline font-bold text-lg" style={{ color: 'var(--color-text)' }}>
            Apertura de Turno
          </p>
          <p className="font-body text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Hola, {cashierName}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          <div>
            <label
              className="block font-body text-xs font-semibold mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              FONDO INICIAL DE CAJA (CLP)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={float}
              onChange={e => setFloat(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
              autoFocus
              className="w-full px-4 py-3 rounded text-2xl font-mono font-bold text-right focus:outline-none"
              style={{
                background: 'var(--color-surface)',
                border:     '1px solid var(--color-border)',
                color:      'var(--color-text)',
              }}
            />
            {floatNum > 0 && (
              <p className="font-body text-xs mt-1.5 text-right" style={{ color: 'var(--color-text-muted)' }}>
                {formatCLP(floatNum)}
              </p>
            )}
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded text-sm font-body"
              style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleOpen}
            disabled={loading}
            className="w-full py-3.5 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
            style={{
              background: loading ? 'var(--color-border)' : 'var(--heuk-950, #0a0a0a)',
              color:      loading ? 'var(--color-text-disabled)' : '#f5f5f2',
              cursor:     loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Abriendo turno…' : 'Abrir turno'}
          </button>

          <p className="font-body text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            El fondo inicial puede ser $0 si la caja parte vacía
          </p>
        </div>
      </div>
    </div>
  )
}
