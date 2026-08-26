'use client'
import { useState } from 'react'
import { formatCLP } from '@seul/ui'
import type { ActiveShift } from '@/lib/shift-store'
import type { ActiveTillSession } from '@/lib/till-session-store'

interface TillGateProps {
  shift:       ActiveShift
  cashierName: string
  apiUrl:      string
  deviceId:    string
  onTillOpen:  (till: ActiveTillSession) => void
  onLogout?:   () => void
}

export function TillGate({ shift, cashierName, apiUrl, deviceId, onTillOpen, onLogout }: TillGateProps) {
  const [float,   setFloat]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const floatNum = parseInt(float.replace(/\D/g, ''), 10) || 0

  async function handleOpen() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${apiUrl}/api/till-sessions/open`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shift_id:          shift.id,
          device_id:         deviceId,
          opening_float_clp: floatNum,
        }),
      })

      const data = await res.json() as { tillSession?: ActiveTillSession; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'No se pudo abrir la caja')
        return
      }

      if (data.tillSession) {
        onTillOpen({
          id:            data.tillSession.id,
          sessionNumber: data.tillSession.sessionNumber,
          shiftId:       data.tillSession.shiftId,
          openedAt:      data.tillSession.openedAt,
          openingFloat:  data.tillSession.openingFloat,
          deviceId:      data.tillSession.deviceId,
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
            Apertura de Caja
          </p>
          <p className="font-body text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Hola, {cashierName} · Turno #{shift.shiftNumber}
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
            {loading ? 'Abriendo caja…' : 'Abrir Caja'}
          </button>

          <p className="font-body text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            El fondo inicial puede ser $0 si la caja parte vacía
          </p>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full pt-1 font-body text-xs text-center transition-opacity hover:opacity-100"
              style={{ color: 'var(--color-text-muted)', opacity: 0.55 }}
            >
              Cerrar sesión / Cambiar usuario
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
