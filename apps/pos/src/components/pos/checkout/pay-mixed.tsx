'use client'
import { useState } from 'react'
import { formatCLP } from '@seul/ui'
import { POSNumpad } from '@seul/ui/pos/numpad'
import { calcRemaining, isCovered, tenderMethodLabel, type Tender } from '@/lib/payment-methods'
import { PayCash } from './pay-cash'
import { PayCard } from './pay-card'
import { PayQR } from './pay-qr'
import { IconClose, IconCheck } from '../../icons/pos-icons'

interface PayMixedProps {
  total:      number
  tenders:    Tender[]
  onAddTender: (t: Tender) => void
  onRemoveTender: (index: number) => void
  onReady:    () => void
  onNotReady: () => void
}

type SplitMethod = 'debit' | 'credit' | 'qr'
type Active =
  | { method: 'cash' }
  | { method: SplitMethod; step: 'amount' | 'terminal' }
  | null

const SPLITTABLE_METHODS: Array<{ id: 'cash' | SplitMethod; label: string }> = [
  { id: 'cash',   label: 'Efectivo' },
  { id: 'debit',  label: 'Débito' },
  { id: 'credit', label: 'Crédito' },
  { id: 'qr',     label: 'QR / Transf.' },
]

const SPLIT_METHOD_LABEL: Record<SplitMethod, string> = {
  debit:  'Débito',
  credit: 'Crédito',
  qr:     'QR / Transferencia',
}

export function PayMixed({
  total, tenders, onAddTender, onRemoveTender, onReady, onNotReady,
}: PayMixedProps) {
  const [active, setActive] = useState<Active>(null)
  // Monto elegido para el método activo (débito/crédito/QR) — por defecto el
  // restante completo, pero editable: así se puede dividir aunque el primer
  // método elegido no sea efectivo (antes esto SIEMPRE cobraba el total
  // restante de una sola vez en tarjeta/QR, haciendo imposible partir el pago
  // si no se empezaba por efectivo — reportado por el dueño 2026-09-02).
  const [splitAmount, setSplitAmount] = useState('0')

  const remaining = calcRemaining(total, tenders)
  const covered   = isCovered(total, tenders)
  const splitAmountNum = Math.min(parseInt(splitAmount, 10) || 0, remaining)

  function openSplitMethod(method: SplitMethod) {
    setSplitAmount(String(remaining))
    setActive({ method, step: 'amount' })
  }

  function addCash(received: number) {
    const amount = Math.min(received, remaining)
    onAddTender({ method: 'cash', amount })
    setActive(null)
    if (isCovered(total, [...tenders, { method: 'cash', amount }])) onReady()
  }

  function addSplit(method: SplitMethod, amount: number) {
    const capped = Math.min(Math.max(amount, 1), remaining)
    onAddTender({ method, amount: capped })
    setActive(null)
    if (isCovered(total, [...tenders, { method, amount: capped }])) onReady()
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
      {!covered && !active && (
        <div>
          <p
            className="font-body text-[10px] font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
          >
            AGREGAR PAGO PARCIAL
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SPLITTABLE_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => m.id === 'cash' ? setActive({ method: 'cash' }) : openSplitMethod(m.id)}
                className="rounded py-3 font-body text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: 'var(--color-surface)',
                  border:     '1px solid var(--color-border)',
                  color:      'var(--color-text)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Efectivo — ya soporta monto parcial vía numpad propio */}
      {active?.method === 'cash' && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Efectivo — hasta {formatCLP(remaining)}
            </p>
            <button
              onClick={() => setActive(null)}
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

      {/* Paso 1 para débito/crédito/QR dentro de mixto: elegir CUÁNTO de este
          método (antes se cobraba siempre el restante completo, impidiendo
          dividir si no se empezaba por efectivo). */}
      {active && active.method !== 'cash' && active.step === 'amount' && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {SPLIT_METHOD_LABEL[active.method]} — monto a cobrar
            </p>
            <button
              onClick={() => setActive(null)}
              className="font-body text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancelar
            </button>
          </div>

          <div
            className="rounded px-4 py-3"
            style={{ background: 'var(--color-surface)' }}
          >
            <p
              className="font-body text-xs font-semibold tracking-widest mb-1"
              style={{ color: 'var(--color-text-muted)', letterSpacing: '0.12em' }}
            >
              MONTO (máx. {formatCLP(remaining)})
            </p>
            <p className="font-mono font-black leading-none" style={{ fontSize: 40, color: 'var(--color-text)' }}>
              {formatCLP(splitAmountNum)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSplitAmount(String(remaining))}
              className="rounded py-2.5 font-body font-semibold text-sm transition-all active:scale-95"
              style={{
                background: splitAmountNum === remaining ? 'var(--color-celadon, #7ca38e)' : 'var(--color-surface)',
                color:      splitAmountNum === remaining ? '#fff' : 'var(--color-text)',
                border:     `1px solid ${splitAmountNum === remaining ? 'var(--color-celadon, #7ca38e)' : 'var(--color-border)'}`,
              }}
            >
              Todo el restante
            </button>
            <button
              onClick={() => setSplitAmount(String(Math.round(remaining / 2)))}
              className="rounded py-2.5 font-body font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              Mitad ({formatCLP(Math.round(remaining / 2))})
            </button>
          </div>

          <POSNumpad value={splitAmount} onChange={setSplitAmount} mode="integer" />

          <button
            disabled={splitAmountNum <= 0}
            onClick={() => setActive({ method: active.method, step: 'terminal' })}
            className="w-full rounded py-3 font-body font-semibold text-sm transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--heuk-950, #0a0a0a)', color: '#f5f5f2' }}
          >
            Continuar con {formatCLP(splitAmountNum)}
          </button>
        </div>
      )}

      {/* Paso 2: terminal de tarjeta para el monto ya elegido */}
      {active && (active.method === 'debit' || active.method === 'credit') && active.step === 'terminal' && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {SPLIT_METHOD_LABEL[active.method]} — {formatCLP(splitAmountNum)}
            </p>
            <button
              onClick={() => setActive({ method: active.method, step: 'amount' })}
              className="font-body text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cambiar monto
            </button>
          </div>
          <PayCard
            total={splitAmountNum}
            type={active.method}
            onReady={() => addSplit(active.method, splitAmountNum)}
          />
        </div>
      )}

      {/* Paso 2: QR/transferencia para el monto ya elegido */}
      {active?.method === 'qr' && active.step === 'terminal' && !covered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              QR / Transferencia — {formatCLP(splitAmountNum)}
            </p>
            <button
              onClick={() => setActive({ method: 'qr', step: 'amount' })}
              className="font-body text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cambiar monto
            </button>
          </div>
          <PayQR
            total={splitAmountNum}
            onReady={() => addSplit('qr', splitAmountNum)}
            onNotReady={() => {}}
          />
        </div>
      )}
    </div>
  )
}
