'use client'
import { useState } from 'react'
import { BAESValidator } from '@seul/ui/pos/baes-validator'
import { formatCLP } from '@seul/ui'
import { IconBAES, IconCheck } from '../../icons/pos-icons'
import { PayCash } from './pay-cash'
import { PayCard } from './pay-card'
import type { BAESSession } from '@/lib/pos-store'

interface PayBAESProps {
  baesTotal:      number    // monto elegible BAES
  remainder:      number    // monto no-BAES a cobrar con otro medio
  baesSession:    BAESSession | null
  onBAES:         (s: BAESSession | null) => void
  onReady:        (secondMethod: 'cash' | 'debit' | 'credit', received?: number) => void
  onNotReady:     () => void
}

type SecondMethod = 'cash' | 'debit' | 'credit' | null

export function PayBAES({
  baesTotal, remainder, baesSession, onBAES, onReady, onNotReady,
}: PayBAESProps) {
  const [secondMethod, setSecondMethod] = useState<SecondMethod>(null)
  const [secondReady,  setSecondReady]  = useState(false)
  const [cashReceived, setCashReceived] = useState(0)

  const validated = !!baesSession
  const needsSecond = remainder > 0

  function handleSecondReady(received?: number) {
    setSecondReady(true)
    if (received !== undefined) setCashReceived(received)
    if (secondMethod) onReady(secondMethod, received)
  }

  function handleSecondNotReady() {
    setSecondReady(false)
    onNotReady()
  }

  // Si no hay monto de segundo método, solo BAES alcanza
  if (validated && !needsSecond) {
    onReady('cash', 0)
  }

  return (
    <div className="space-y-5">
      {/* Banner BAES */}
      <div
        className="rounded px-4 py-3 flex items-center gap-3"
        style={{
          background: validated ? 'var(--color-baes-applied-bg)' : 'var(--color-surface)',
          border: `1px solid ${validated ? 'var(--color-baes-eligible)' : 'var(--color-border)'}`,
        }}
      >
        <IconBAES size={24} color={validated ? 'var(--color-baes-applied-text)' : 'var(--color-text-muted)'} />
        <div className="flex-1">
          <p
            className="font-body text-xs font-semibold tracking-widest"
            style={{ color: validated ? 'var(--color-baes-applied-text)' : 'var(--color-text-muted)', letterSpacing: '0.12em' }}
          >
            SUBSIDIO BAES — JUNAEB
          </p>
          {validated ? (
            <div className="flex items-center gap-2 mt-0.5">
              <IconCheck size={14} color="var(--color-baes-eligible)" />
              <p className="font-body text-sm font-bold" style={{ color: 'var(--color-baes-applied-text)' }}>
                {baesSession.name} · Cubre {formatCLP(baesTotal)}
              </p>
            </div>
          ) : (
            <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Valida la TNE del estudiante
            </p>
          )}
        </div>
        {validated && (
          <p className="font-mono font-black text-xl" style={{ color: 'var(--color-baes-applied-text)' }}>
            {formatCLP(baesTotal)}
          </p>
        )}
      </div>

      {/* Validador TNE */}
      {!validated && <BAESValidator onValidated={onBAES} />}

      {/* Segundo medio de pago si hay remainder */}
      {validated && needsSecond && (
        <div className="space-y-4">
          <div
            className="flex items-center justify-between px-4 py-2 rounded"
            style={{ background: 'var(--color-surface)' }}
          >
            <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Saldo restante
            </p>
            <p className="font-mono font-black text-xl" style={{ color: 'var(--color-text)' }}>
              {formatCLP(remainder)}
            </p>
          </div>

          {/* Selector segundo método */}
          {!secondMethod && (
            <div>
              <p
                className="font-body text-xs font-semibold tracking-widest mb-2"
                style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
              >
                SEGUNDO MEDIO DE PAGO
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'debit', 'credit'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setSecondMethod(m)}
                    className="rounded py-3 font-body text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: 'var(--color-surface)',
                      border:     '1px solid var(--color-border)',
                      color:      'var(--color-text)',
                    }}
                  >
                    {m === 'cash' ? 'Efectivo' : m === 'debit' ? 'Débito' : 'Crédito'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* UI del segundo método */}
          {secondMethod === 'cash' && (
            <PayCash
              total={remainder}
              onReady={(r) => handleSecondReady(r)}
              onNotReady={handleSecondNotReady}
            />
          )}
          {(secondMethod === 'debit' || secondMethod === 'credit') && (
            <PayCard
              total={remainder}
              type={secondMethod}
              onReady={() => handleSecondReady()}
            />
          )}
        </div>
      )}
    </div>
  )
}
