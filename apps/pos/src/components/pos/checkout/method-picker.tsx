'use client'
import { PAYMENT_METHODS, type PaymentMethodId } from '@/lib/payment-methods'
import { IconBAES } from '../../icons/pos-icons'
import { Bike } from 'lucide-react'

// SVG inline para métodos de pago
function IconCash({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="2" y="7" width="24" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="14" cy="14" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 11h3M23 11h3M2 17h3M23 17h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconCard({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="2" y="6" width="24" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M2 11h24" stroke="currentColor" strokeWidth="2"/>
      <rect x="5" y="15" width="5" height="3" rx="0.8" fill="currentColor" opacity="0.5"/>
      <path d="M18 16.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconQR({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="3" y="3" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="16" y="3" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="16" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="5.5" y="5.5" width="4" height="4" rx="0.5" fill="currentColor"/>
      <rect x="18.5" y="5.5" width="4" height="4" rx="0.5" fill="currentColor"/>
      <rect x="5.5" y="18.5" width="4" height="4" rx="0.5" fill="currentColor"/>
      <path d="M16 16h3v3h-3zM19 19h3v3h-3zM16 22h3M22 16v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconMixed({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="2" y="5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 9h15" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="20" cy="18" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M18 18h4M20 16v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function MethodIcon({ id, size = 28 }: { id: PaymentMethodId; size?: number }) {
  switch (id) {
    case 'cash':   return <IconCash size={size} />
    case 'debit':  return <IconCard size={size} />
    case 'credit': return <IconCard size={size} />
    case 'baes':   return <IconBAES size={size} />
    case 'qr':     return <IconQR size={size} />
    case 'mixed':  return <IconMixed size={size} />
    case 'cod':    return <Bike size={size} />
  }
}

const COD_METHOD = { id: 'cod' as PaymentMethodId, label: 'Cobrar en Puerta', labelKo: '현관 결제' }

interface MethodPickerProps {
  selected:      PaymentMethodId | null
  onSelect:      (id: PaymentMethodId) => void
  hasBaes?:      boolean
  deliveryMode?: 'local' | 'delivery'
  rappiOnly?:    boolean
}

export function MethodPicker({ selected, onSelect, hasBaes, deliveryMode, rappiOnly }: MethodPickerProps) {
  const methods = rappiOnly
    ? PAYMENT_METHODS.filter(m => m.id === 'qr')
    : deliveryMode === 'delivery'
      ? [...PAYMENT_METHODS, COD_METHOD]
      : PAYMENT_METHODS

  return (
    <div className="space-y-3">
      <p
        className="font-body text-xs font-semibold tracking-widest"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
      >
        MEDIO DE PAGO
      </p>

      <div className="grid grid-cols-3 gap-3">
        {methods.map(m => {
          const isActive  = selected === m.id
          const isBaesRow = m.id === 'baes'
          const isCodRow  = m.id === 'cod'

          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="flex flex-col items-center justify-center gap-2 rounded transition-all active:scale-[0.97]"
              style={{
                minHeight: 'var(--pos-hit-area-min)',
                padding: '14px 8px',
                background: isActive
                  ? isBaesRow ? 'var(--color-baes-applied-bg)'
                  : isCodRow  ? 'var(--color-error-subtle)'
                  : 'var(--heuk-950, #0a0a0a)'
                  : 'var(--color-surface)',
                border: `1.5px solid ${isActive
                  ? isBaesRow ? 'var(--color-baes-eligible)'
                  : isCodRow  ? 'var(--color-error)'
                  : 'var(--heuk-950, #0a0a0a)'
                  : 'var(--color-border)'}`,
                color: isActive
                  ? isBaesRow ? 'var(--color-baes-applied-text)'
                  : isCodRow  ? 'var(--color-error)'
                  : '#f5f5f2'
                  : 'var(--color-text)',
              }}
              aria-pressed={isActive}
            >
              <MethodIcon id={m.id} size={24} />
              <div className="text-center">
                <p className="font-body font-semibold text-xs leading-tight">{m.label}</p>
                <p
                  className="font-korean text-[10px] mt-0.5"
                  style={{ opacity: 0.6 }}
                >
                  {m.labelKo}
                </p>
              </div>
              {isBaesRow && hasBaes && (
                <span
                  className="font-body text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-baes-eligible)', color: '#fff' }}
                >
                  ACTIVO
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
