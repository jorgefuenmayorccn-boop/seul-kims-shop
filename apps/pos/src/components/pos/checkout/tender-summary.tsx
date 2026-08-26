import { formatCLP } from '@seul/ui'
import { tenderMethodLabel, type Tender } from '@/lib/payment-methods'
import { IconCheck } from '../../icons/pos-icons'
import type { BAESSession } from '@/lib/pos-store'

interface TenderSummaryProps {
  subtotal:    number
  baesAmount:  number
  total:       number
  tenders:     Tender[]
  baesSession: BAESSession | null
  change:      number
}

export function TenderSummary({
  subtotal, baesAmount, total, tenders, baesSession, change,
}: TenderSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Desglose */}
      <div
        className="rounded px-4 py-3 space-y-2"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          className="font-body text-[10px] font-semibold tracking-widest"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
        >
          RESUMEN DE VENTA
        </p>

        {subtotal !== total && (
          <div className="flex justify-between text-sm font-body">
            <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
            <span className="font-mono" style={{ color: 'var(--color-text)' }}>{formatCLP(subtotal)}</span>
          </div>
        )}

        {baesAmount > 0 && baesSession && (
          <div className="flex justify-between text-sm font-body">
            <span style={{ color: 'var(--color-baes-applied-text)', fontWeight: 600 }}>
              BAES — {baesSession.name}
            </span>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-baes-applied-text)' }}>
              − {formatCLP(baesAmount)}
            </span>
          </div>
        )}

        <div
          className="flex justify-between items-center pt-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="font-body font-bold" style={{ color: 'var(--color-text)' }}>Total</span>
          <span className="font-mono font-black text-2xl" style={{ color: 'var(--color-text)' }}>
            {formatCLP(total)}
          </span>
        </div>
      </div>

      {/* Pagos */}
      <div
        className="rounded px-4 py-3 space-y-2"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          className="font-body text-[10px] font-semibold tracking-widest"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
        >
          MEDIOS DE PAGO
        </p>

        {tenders.map((t, i) => (
          <div key={i} className="flex justify-between text-sm font-body">
            <span style={{ color: 'var(--color-text)' }}>{tenderMethodLabel(t.method)}</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-text)' }}>
              {formatCLP(t.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Vuelto */}
      {change > 0 && (
        <div
          className="rounded px-4 py-4 flex items-center justify-between"
          style={{ background: 'var(--color-baes-applied-bg)', border: '1px solid var(--color-baes-eligible)' }}
        >
          <div className="flex items-center gap-2">
            <IconCheck size={18} color="var(--color-baes-eligible)" />
            <span className="font-body font-semibold text-sm" style={{ color: 'var(--color-baes-applied-text)' }}>
              Vuelto al cliente
            </span>
          </div>
          <span className="font-mono font-black text-2xl" style={{ color: 'var(--color-baes-applied-text)' }}>
            {formatCLP(change)}
          </span>
        </div>
      )}
    </div>
  )
}
