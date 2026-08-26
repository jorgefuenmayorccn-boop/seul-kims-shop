'use client'
import { useState } from 'react'
import { formatCLP } from '@seul/ui'
import { calcRemaining, isCovered, tenderMethodLabel, type Tender } from '@/lib/payment-methods'
import { PayCash } from './pay-cash'
import { PayCard } from './pay-card'
import { IconClose, IconCheck } from '../../icons/pos-icons'

interface PayMixedProps {
  total:      number
  tenders:    Tender[]
  onAddTender: (t: Tender) => void
  onRemoveTender: (index: number) => void
  onReady:    () => void
  onNotReady: () => void
}

type ActiveMethod = 'cash' | 'debit' | 'credit' | null

export function PayMixed({
  total, tenders, onAddTender, onRemoveTender, onReady, onNotReady,
}: PayMixedProps) {
  const [activeMethod, setActiveMethod] = useState<ActiveMethod>(null)
  const remaining = calcRemaining(total, tenders)
  const covered   = isCovered(total, tenders)

  function addCash(received: number) {
    const amount = Math.min(received, remaining)
    onAddTender({ method: 'cash', amount })
    setActiveMethod(null)
    if (isCovered(total, [...tenders, { method: 'cash', amount }])) onReady()
  }

  function addCard(method: 'debit' | 'credit') {
    onAddTender({ method, amount: remaining })
    setActiveMethod(null)
    onReady()
  }

  return (
    <div className="space-y-4">
      {/* Resumen tenders acumulados */}
      {tenders.length > 0 && (
        <div
          className="rounded px-4 py-3 space-y-2"
          style={{ background: 'var(--color-surface)' }}
        >
          <p
            className="font-body text-[10px] font-semibold tracking-widest"
            style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
          >
            PAGOS ACUMULADOS
          </p>
          {tenders.map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onRemoveTender(i); onNotReady() }}
                  className="w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:opacity-70"
                  style={{ background: 'var(--color-error-subtle)' }}
                  aria-label="Quitar pago"
                >
                  <IconClose size={10} color="var(--color-error)" />
                </button>
                <span className="font-body text-sm" style={{ color: 'var(--color-text)' }}>
                  {tenderMethodLabel(t.method)}
                </span>
              </div>
              <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                {formatCLP(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progreso */}
      <div
        className="rounded p-4"
        style={{ background: 'var(--color-surface)' }}
      >
        <div className="flex justify-between text-sm font-body mb-2">
          <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
          <span className="font-mono font-bold" style={{ color: 'var(--color-text)' }}>{formatCLP(total)}</span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, ((total - remaining) / total) * 100)}%`,
              background: covered ? 'var(--color-baes-eligible)' : 'var(--color-brand)',
            }}
          />
        </div>
        <div className="flex justify-between text-sm font-body mt-2">
          <span style={{ color: 'var(--color-text-muted)' }}>
            {covered ? 'Cubierto' : 'Falta'}
          </span>
          <span
            className="font-mono font-black text-lg"
            style={{ color: covered ? 'var(--color-baes-eligible)' : 'var(--color-text)' }}
          >
            {covered ? <IconCheck size={20} color="var(--color-baes-eligible)" /> : formatCLP(remaining)}
          </span>
        </div>
      </div>

      {/* Selector siguiente método */}
      {!covered && !activeMethod && (
        <div>
          <p
            className="font-body text-[10px] font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
          >
            AGREGAR PAGO PARCIAL
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'debit', 'credit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMethod(m)}
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

      {/* UI del método activo */}
      {activeMethod === 'cash' && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Efectivo — hasta {formatCLP(remaining)}
            </p>
            <button
              onClick={() => setActiveMethod(null)}
              className="font-body text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancelar
            </button>
          </div>
          <PayCash
            total={remaining}
            onReady={(r) => addCash(r)}
            onNotReady={() => {}}
          />
        </div>
      )}

      {(activeMethod === 'debit' || activeMethod === 'credit') && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {activeMethod === 'debit' ? 'Débito' : 'Crédito'} — {formatCLP(remaining)}
            </p>
            <button
              onClick={() => setActiveMethod(null)}
              className="font-body text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancelar
            </button>
          </div>
          <PayCard
            total={remaining}
            type={activeMethod}
            onReady={() => addCard(activeMethod)}
          />
        </div>
      )}
    </div>
  )
}
