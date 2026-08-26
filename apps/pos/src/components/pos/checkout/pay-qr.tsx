'use client'
import { useState, useEffect } from 'react'
import { formatCLP } from '@seul/ui'
import { IconCheck } from '../../icons/pos-icons'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface PayQRProps {
  total:      number
  onReady:    () => void
  onNotReady: () => void
}

interface BankConfig {
  bank_name:         string
  bank_account:      string
  bank_account_type: string
  bank_rut:          string
  bank_holder:       string
}

// QR SVG estático — en producción reemplazar por qrcode lib con datos reales de cuenta
function QRPlaceholder({ value }: { value: string }) {
  return (
    <div
      className="w-40 h-40 rounded flex items-center justify-center mx-auto"
      style={{ background: '#fff', border: '2px solid var(--color-border)' }}
      title={value}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-label="Código QR de transferencia">
        <rect x="4" y="4" width="32" height="32" rx="2" fill="#0a0a0a"/>
        <rect x="8" y="8" width="24" height="24" rx="1" fill="white"/>
        <rect x="12" y="12" width="16" height="16" rx="0.5" fill="#0a0a0a"/>
        <rect x="84" y="4" width="32" height="32" rx="2" fill="#0a0a0a"/>
        <rect x="88" y="8" width="24" height="24" rx="1" fill="white"/>
        <rect x="92" y="12" width="16" height="16" rx="0.5" fill="#0a0a0a"/>
        <rect x="4" y="84" width="32" height="32" rx="2" fill="#0a0a0a"/>
        <rect x="8" y="88" width="24" height="24" rx="1" fill="white"/>
        <rect x="12" y="92" width="16" height="16" rx="0.5" fill="#0a0a0a"/>
        {[
          [44,4],[52,4],[60,4],[68,4],[44,12],[68,12],[44,20],[52,20],[60,20],[68,20],
          [44,28],[52,28],[60,28],[44,36],[52,36],[60,36],[68,36],
          [4,44],[12,44],[28,44],[36,44],[44,44],[60,44],[68,44],[76,44],[84,44],[100,44],[116,44],
          [4,52],[20,52],[36,52],[52,52],[76,52],[92,52],[108,52],
          [4,60],[12,60],[28,60],[44,60],[60,60],[76,60],[84,60],[100,60],[116,60],
          [4,68],[20,68],[36,68],[52,68],[60,68],[84,68],[100,68],
          [4,76],[12,76],[20,76],[36,76],[44,76],[52,76],[68,76],[76,76],[92,76],[108,76],
          [44,84],[52,84],[68,84],[84,84],[92,84],[100,84],[108,84],
          [44,92],[60,92],[76,92],[84,92],[100,92],[116,92],
          [44,100],[52,100],[60,100],[68,100],[76,100],[84,100],[100,100],[108,100],[116,100],
          [44,108],[52,108],[68,108],[76,108],[92,108],[108,108],
          [44,116],[60,116],[68,116],[84,116],[92,116],[100,116],[108,116],[116,116],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="6" height="6" fill="#0a0a0a"/>
        ))}
      </svg>
    </div>
  )
}

export function PayQR({ total, onReady, onNotReady }: PayQRProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [bank, setBank]           = useState<BankConfig | null>(null)

  useEffect(() => {
    fetch(`${API}/api/tienda-config/public`)
      .then(r => r.json())
      .then((d: { config?: BankConfig }) => { if (d.config) setBank(d.config) })
      .catch(() => {})
  }, [])

  function handleConfirm() {
    setConfirmed(true)
    onReady()
  }

  const bankRows = bank ? [
    { label: 'Banco',   value: bank.bank_name         || '—' },
    { label: 'Cuenta',  value: bank.bank_account       || '—' },
    { label: 'Tipo',    value: bank.bank_account_type  || '—' },
    { label: 'RUT',     value: bank.bank_rut           || '—' },
    { label: 'Nombre',  value: bank.bank_holder        || '—' },
    { label: 'Monto',   value: formatCLP(total)                },
  ] : [
    { label: 'Monto',   value: formatCLP(total) },
  ]

  return (
    <div className="space-y-4">
      <div
        className="rounded px-4 py-3 text-center"
        style={{ background: 'var(--color-surface)' }}
      >
        <p
          className="font-body text-xs font-semibold tracking-widest mb-1"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
        >
          TRANSFERENCIA / QR
        </p>
        <p className="font-mono font-black" style={{ fontSize: 44, color: 'var(--color-text)' }}>
          {formatCLP(total)}
        </p>
      </div>

      {!confirmed ? (
        <div className="space-y-4">
          <QRPlaceholder value={`seulkims|${total}|${Date.now()}`} />

          <div
            className="rounded px-4 py-3 space-y-1.5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p
              className="font-body text-[10px] font-semibold tracking-widest"
              style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
            >
              DATOS TRANSFERENCIA
            </p>
            {bankRows.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="font-body" style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirm}
            className="w-full rounded py-3 font-body font-semibold text-sm transition-all active:scale-95"
            style={{
              background: 'var(--heuk-950, #0a0a0a)',
              color:      '#f5f5f2',
            }}
          >
            Confirmar transferencia recibida
          </button>
        </div>
      ) : (
        <div
          className="rounded p-5 flex flex-col items-center gap-3"
          style={{ background: 'var(--color-baes-applied-bg)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-baes-eligible)' }}
          >
            <IconCheck size={24} color="#fff" />
          </div>
          <p className="font-body font-bold text-sm" style={{ color: 'var(--color-baes-applied-text)' }}>
            Transferencia confirmada
          </p>
        </div>
      )}
    </div>
  )
}
