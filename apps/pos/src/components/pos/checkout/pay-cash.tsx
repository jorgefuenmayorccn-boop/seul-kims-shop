'use client'
import { useState, useEffect } from 'react'
import { POSNumpad } from '@seul/ui/pos/numpad'
import { formatCLP } from '@seul/ui'
import { QUICK_CASH_AMOUNTS, calcChange } from '@/lib/payment-methods'

interface PayCashProps {
  total:      number
  onReady:    (received: number) => void
  onNotReady: () => void
}

export function PayCash({ total, onReady, onNotReady }: PayCashProps) {
  const [received, setReceived] = useState('0')

  const receivedNum = parseInt(received, 10) || 0
  const change      = calcChange(receivedNum, total)
  const covered     = receivedNum >= total
  const missing     = covered ? 0 : total - receivedNum

  useEffect(() => {
    if (covered) onReady(receivedNum)
    else onNotReady()
  }, [receivedNum, covered]) // eslint-disable-line react-hooks/exhaustive-deps

  function setQuick(amount: number) {
    setReceived(String(amount))
  }

  function setExact() {
    setReceived(String(total))
  }

  return (
    <div className="space-y-4">
      {/* Display recibido */}
      <div
        className="rounded px-4 py-3 space-y-1"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          className="font-body text-xs font-semibold tracking-widest"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.12em' }}
        >
          RECIBIDO
        </p>
        <p
          className="font-mono font-black leading-none"
          style={{
            fontSize: 40,
            color: covered ? 'var(--color-text)' : 'var(--color-text-muted)',
          }}
        >
          {receivedNum > 0 ? formatCLP(receivedNum) : '$0'}
        </p>

        {/* Vuelto / Falta */}
        {covered && change > 0 && (
          <div
            className="flex items-center justify-between pt-2 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              Vuelto
            </p>
            <p
              className="font-mono font-black text-3xl"
              style={{ color: 'var(--color-baes-eligible)' }}
            >
              {formatCLP(change)}
            </p>
          </div>
        )}
        {covered && change === 0 && (
          <p className="font-body text-xs font-semibold" style={{ color: 'var(--color-baes-eligible)' }}>
            Monto exacto
          </p>
        )}
        {!covered && receivedNum > 0 && (
          <p className="font-body text-xs" style={{ color: 'var(--color-error)' }}>
            Faltan {formatCLP(missing)}
          </p>
        )}
      </div>

      {/* Montos rapidos */}
      <div>
        <p
          className="font-body text-[10px] font-semibold tracking-widest mb-2"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
        >
          MONTOS RAPIDOS
        </p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_CASH_AMOUNTS.map(amt => (
            <button
              key={amt}
              onClick={() => setQuick(amt)}
              className="rounded font-mono font-bold text-sm py-2.5 transition-all active:scale-95"
              style={{
                background: receivedNum === amt ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-surface)',
                color:      receivedNum === amt ? '#f5f5f2' : 'var(--color-text)',
                border:     `1px solid ${receivedNum === amt ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)'}`,
              }}
            >
              {formatCLP(amt)}
            </button>
          ))}
          <button
            onClick={setExact}
            className="col-span-2 rounded font-body font-semibold text-sm py-2.5 transition-all active:scale-95"
            style={{
              background: receivedNum === total ? 'var(--color-celadon, #7ca38e)' : 'var(--color-surface)',
              color:      receivedNum === total ? '#fff' : 'var(--color-text)',
              border:     `1px solid ${receivedNum === total ? 'var(--color-celadon, #7ca38e)' : 'var(--color-border)'}`,
            }}
          >
            Exacto — {formatCLP(total)}
          </button>
        </div>
      </div>

      {/* Numpad */}
      <POSNumpad
        value={received}
        onChange={setReceived}
        mode="integer"
      />
    </div>
  )
}
