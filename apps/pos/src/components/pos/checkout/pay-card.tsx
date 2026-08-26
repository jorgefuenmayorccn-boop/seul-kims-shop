'use client'
import { useState, useEffect } from 'react'
import { formatCLP } from '@seul/ui'
import { IconCheck } from '../../icons/pos-icons'

type CardType = 'debit' | 'credit'

interface PayCardProps {
  total:    number
  type:     CardType
  onReady:  () => void
}

type State = 'waiting' | 'approved' | 'rejected'

export function PayCard({ total, type, onReady }: PayCardProps) {
  const [state, setState] = useState<State>('waiting')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (state !== 'waiting') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [state])

  function handleApprove() {
    setState('approved')
    onReady()
  }

  function handleReject() {
    setState('rejected')
  }

  function handleRetry() {
    setState('waiting')
    setElapsed(0)
  }

  return (
    <div className="space-y-5">
      {/* Monto */}
      <div
        className="rounded px-4 py-3 text-center"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          className="font-body text-xs font-semibold tracking-widest mb-1"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
        >
          {type === 'debit' ? 'DÉBITO' : 'CRÉDITO'} — TOTAL A COBRAR
        </p>
        <p className="font-mono font-black" style={{ fontSize: 44, color: 'var(--color-text)' }}>
          {formatCLP(total)}
        </p>
      </div>

      {/* Estado terminal */}
      {state === 'waiting' && (
        <div className="space-y-4">
          <div
            className="rounded p-6 flex flex-col items-center gap-3 border"
            style={{ borderColor: 'var(--color-border)', borderStyle: 'dashed' }}
          >
            {/* Animación pulsante */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'var(--color-text)', opacity: 0.08 }}
              />
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                <rect x="3" y="6" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M3 12h26" stroke="currentColor" strokeWidth="2.5"/>
                <rect x="6" y="17" width="7" height="4" rx="1" fill="currentColor" opacity="0.4"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                Pasa o acerca la tarjeta en el PinPad
              </p>
              <p className="font-korean text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                카드를 단말기에 대주세요
              </p>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {elapsed}s esperando...
              </p>
            </div>
          </div>

          {/* Botones manuales v1.0 (Transbank simulado) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleReject}
              className="rounded py-3 font-body font-semibold text-sm transition-all active:scale-95"
              style={{
                background: 'var(--color-error-subtle)',
                color:      'var(--color-error)',
                border:     '1px solid var(--color-error)',
              }}
            >
              Rechazado
            </button>
            <button
              onClick={handleApprove}
              className="rounded py-3 font-body font-semibold text-sm transition-all active:scale-95"
              style={{
                background: 'var(--heuk-950, #0a0a0a)',
                color:      '#f5f5f2',
              }}
            >
              Aprobado
            </button>
          </div>

          <p
            className="font-body text-xs text-center"
            style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}
          >
            Integración Transbank POS Integrado disponible en v1.1
          </p>
        </div>
      )}

      {state === 'approved' && (
        <div
          className="rounded p-6 flex flex-col items-center gap-3"
          style={{ background: 'var(--color-baes-applied-bg)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-baes-eligible)' }}
          >
            <IconCheck size={24} color="#fff" />
          </div>
          <div className="text-center">
            <p className="font-body font-bold text-sm" style={{ color: 'var(--color-baes-applied-text)' }}>
              Transaccion aprobada
            </p>
            <p className="font-mono text-sm font-bold mt-1" style={{ color: 'var(--color-baes-applied-text)' }}>
              {formatCLP(total)}
            </p>
          </div>
        </div>
      )}

      {state === 'rejected' && (
        <div className="space-y-3">
          <div
            className="rounded p-4 text-center"
            style={{ background: 'var(--color-error-subtle)' }}
          >
            <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-error)' }}>
              Transaccion rechazada
            </p>
            <p className="font-body text-xs mt-1" style={{ color: 'var(--color-error)', opacity: 0.7 }}>
              Intente nuevamente o use otro medio de pago
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="w-full rounded py-3 font-body font-semibold text-sm transition-all"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
