'use client'
import { useState } from 'react'
import { X, Banknote, CreditCard, QrCode, AlertCircle, Printer, Check } from 'lucide-react'
import { POSNumpad } from '@seul/ui/pos/numpad'
import { BAESValidator } from '@seul/ui/pos/baes-validator'
import { ColdChainAlert } from '@seul/ui/pos/cold-chain-alert'
import { cn, formatCLP } from '@seul/ui'

type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transbank'

interface CheckoutModalProps {
  subtotal:    number
  baesAmount:  number
  total:       number
  hasFrozen:   boolean
  hasRefrigerated: boolean
  baesSession: { name: string; rut: string } | null
  onBAESValidated: (s: { name: string; rut: string } | null) => void
  onConfirm:   (method: PaymentMethod, received?: number) => Promise<void>
  onClose:     () => void
}

export function CheckoutModal({
  subtotal, baesAmount, total,
  hasFrozen, hasRefrigerated,
  baesSession, onBAESValidated,
  onConfirm, onClose,
}: CheckoutModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [received, setReceived] = useState('0')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const receivedNum = parseFloat(received) || 0
  const change = method === 'cash' ? Math.max(0, receivedNum - total) : 0
  const canConfirm = method !== 'cash' || receivedNum >= total

  async function handleConfirm() {
    if (!canConfirm || loading) return
    setLoading(true)
    try {
      await onConfirm(method, method === 'cash' ? receivedNum : undefined)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-overlay)]">
        <div className="bg-elevated rounded-xl shadow-lg p-10 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <Check size={32} className="text-success" />
          </div>
          <div className="text-center">
            <p className="font-headline text-xl font-bold text-text">¡Venta completada!</p>
            {change > 0 && (
              <p className="text-lg font-mono font-bold text-success mt-2">
                Vuelto: {formatCLP(change)}
              </p>
            )}
            <p className="text-sm text-text-muted mt-1 font-body">
              Boleta enviada a SII · PDF listo para imprimir
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-elevated border border-[var(--color-border)] text-sm font-body hover:bg-surface transition-colors"
            >
              Nueva venta
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-brand text-white text-sm font-body hover:bg-brand-hover transition-colors"
            >
              <Printer size={15} />
              Imprimir boleta
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--color-surface-overlay)]">
      <div className="bg-elevated rounded-t-2xl sm:rounded-xl shadow-lg w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-headline text-lg font-bold text-text">Cobrar</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Cadena de frío */}
          <ColdChainAlert hasFrozen={hasFrozen} hasRefrigerated={hasRefrigerated} />

          {/* BAES */}
          <BAESValidator onValidated={onBAESValidated} />

          {/* Resumen montos */}
          <div className="bg-surface rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm font-body">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-mono text-text">{formatCLP(subtotal)}</span>
            </div>
            {baesAmount > 0 && (
              <div className="flex justify-between text-sm font-body">
                <span className="text-[var(--color-baes-applied-text)] font-semibold">
                  BAES · {baesSession?.name} (−)
                </span>
                <span className="font-mono text-[var(--color-baes-applied-text)] font-semibold">
                  {formatCLP(baesAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
              <span className="font-headline font-bold text-text text-lg">TOTAL</span>
              <span className="font-mono font-bold text-2xl text-brand">{formatCLP(total)}</span>
            </div>
          </div>

          {/* Métodos de pago */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 font-body">
              Medio de pago
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'cash',      label: 'Efectivo',    icon: Banknote },
                { id: 'debit',     label: 'Débito',      icon: CreditCard },
                { id: 'credit',    label: 'Crédito',     icon: CreditCard },
                { id: 'transbank', label: 'Transbank QR',icon: QrCode },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={cn(
                    'flex items-center gap-2 min-h-[var(--pos-hit-area-min)] px-4 rounded-lg border text-sm font-body font-medium transition-all',
                    method === id
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-[var(--color-border)] bg-elevated text-text hover:bg-surface',
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo — numpad + vuelto */}
          {method === 'cash' && (
            <div className="space-y-3">
              <div className="bg-surface rounded-lg p-3">
                <p className="text-xs text-text-muted font-body mb-1">Recibido</p>
                <p className="font-mono text-3xl font-bold text-text">
                  {parseFloat(received) > 0 ? formatCLP(parseFloat(received)) : '$0'}
                </p>
                {receivedNum >= total && (
                  <p className="font-mono text-sm font-bold text-success mt-1">
                    Vuelto: {formatCLP(change)}
                  </p>
                )}
                {receivedNum > 0 && receivedNum < total && (
                  <p className="flex items-center gap-1 text-xs text-error mt-1 font-body">
                    <AlertCircle size={12} />
                    Faltan {formatCLP(total - receivedNum)}
                  </p>
                )}
              </div>
              <POSNumpad
                value={received}
                onChange={setReceived}
                mode="integer"
              />
            </div>
          )}

        </div>

        {/* Footer — botón cobrar */}
        <div className="px-6 pb-6">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              'w-full min-h-[var(--pos-hit-area-min)] rounded-lg font-headline font-bold text-lg transition-all',
              canConfirm && !loading
                ? 'bg-brand text-white hover:bg-brand-hover active:scale-[0.98]'
                : 'bg-[var(--ink-100)] text-text-muted cursor-not-allowed',
            )}
          >
            {loading ? 'Procesando…' : `Cobrar ${formatCLP(total)}`}
          </button>
        </div>

      </div>
    </div>
  )
}
