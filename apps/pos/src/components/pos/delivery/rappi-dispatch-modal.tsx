'use client'
import { useState } from 'react'

interface RappiDispatchModalProps {
  orderId:         string
  orderNumber:     number
  amountToCollect: number
  apiUrl:          string
  onConfirm:       () => void
  onClose:         () => void
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '10px 12px',
  border:       '1px solid var(--color-border)',
  borderRadius: 4,
  background:   'var(--color-surface)',
  color:        'var(--color-text)',
  fontSize:     14,
  fontFamily:   'var(--font-body)',
  outline:      'none',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize:      12,
  fontWeight:    600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color:         'var(--color-text-muted)',
  marginBottom:  6,
  display:       'block',
}

export function RappiDispatchModal({
  orderId, orderNumber, amountToCollect, apiUrl, onConfirm, onClose,
}: RappiDispatchModalProps) {
  const [name,     setName]     = useState('')
  const [tracking, setTracking] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleConfirm() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/delivery/dispatch-rappi`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          thirdPartyName:     name.trim(),
          thirdPartyTracking: tracking.trim() || undefined,
          amountToCollect:    amountToCollect > 0 ? amountToCollect : undefined,
          paymentAtDoor:      amountToCollect > 0 ? 'pending' : 'not_required',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar despacho')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="flex flex-col rounded-lg shadow-2xl"
        style={{
          width:      420,
          background: 'var(--color-surface-elevated)',
          border:     '1px solid var(--color-border)',
          overflow:   'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="font-headline text-base font-bold" style={{ color: 'var(--color-text)' }}>
              Despacho Rappi
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Pedido #{orderNumber}
              {amountToCollect > 0 && ` · Cobrar $${amountToCollect.toLocaleString('es-CL')}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--color-text-muted)' }}
            className="text-lg font-light hover:opacity-70 transition-opacity"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div>
            <label style={labelStyle}>Nombre del Rappitendero *</label>
            <input
              type="text"
              placeholder="Ej. Carlos Ramírez"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>
              Código de seguimiento{' '}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. RPP-39281-VDM"
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="font-body text-sm" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 font-body text-sm py-3 rounded hover:opacity-70 transition-opacity"
            style={{
              border:     '1px solid var(--color-border)',
              background: 'transparent',
              color:      'var(--color-text-muted)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || loading}
            className="flex-[2] font-headline font-bold text-sm py-3 rounded transition-all"
            style={{
              background: name.trim() && !loading ? 'var(--color-brand)' : 'var(--color-border)',
              color:      name.trim() && !loading ? '#fff' : 'var(--color-text-disabled)',
              cursor:     name.trim() && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Confirmando...' : 'Confirmar despacho'}
          </button>
        </div>
      </div>
    </div>
  )
}
