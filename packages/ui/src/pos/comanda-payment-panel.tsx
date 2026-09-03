'use client'
import { useState } from 'react'
import { Landmark, Banknote, CreditCard, Wallet, Printer, PackageCheck } from 'lucide-react'
import { cn } from '../lib/utils'

export type ComandaPaymentMethod = 'transferencia' | 'efectivo' | 'transbank' | 'credito_b2b'

// Panel de "confirmar pago pendiente" — extraído a un componente compartido
// (adición post-entrega, 3-sep-2026) porque apps/pos/.../comandas-view.tsx y
// apps/cerebro/.../comandas/page.tsx tenían implementaciones DUPLICADAS de
// esto: cerebro lo construyó primero, y cuando se agregó crédito B2B/auto-
// print más tarde, POS se quedó atrás sin que nadie lo notara — el dueño lo
// reportó como "no puedo ver cómo agregar el método de pago en las
// comandas" (refiriéndose específicamente a POS). De ahora en más las dos
// apps consumen esta MISMA implementación — no pueden volver a
// desincronizarse.
interface ComandaPaymentPanelProps {
  apiUrl:        string
  orderId:       string
  paymentStatus: 'pending' | 'confirmed'
  paymentMethod: ComandaPaymentMethod | null
  companyId?:    string | null   // habilita el botón "Crédito B2B"
  onConfirmed:   (method: ComandaPaymentMethod) => void
  onPrint:       () => void      // reimprimir comanda + boleta
  compact?:      boolean         // POS: botones con altura mínima táctil
}

const METHOD_LABEL_CONFIRMED: Record<ComandaPaymentMethod, string> = {
  transferencia: 'Pagado (transferencia)',
  efectivo:      'Cobrar efectivo en puerta',
  transbank:     'Cobrar Transbank en puerta',
  credito_b2b:   'Cargado a línea de crédito',
}

const OPTIONS: { id: ComandaPaymentMethod; label: string; icon: typeof Landmark; classes: string }[] = [
  { id: 'transferencia', label: 'Transferencia',   icon: Landmark,    classes: 'bg-success/10 text-success hover:bg-success/20' },
  { id: 'efectivo',      label: 'Efectivo puerta',  icon: Banknote,    classes: 'bg-warning/10 text-yellow-700 hover:bg-warning/20' },
  { id: 'transbank',     label: 'Transbank puerta', icon: CreditCard,  classes: 'bg-accent/10 text-accent hover:bg-accent/20' },
  { id: 'credito_b2b',   label: 'Crédito B2B',      icon: Wallet,      classes: 'bg-brand/10 text-brand hover:bg-brand/20' },
]

export function ComandaPaymentPanel({
  apiUrl, orderId, paymentStatus, paymentMethod, companyId, onConfirmed, onPrint, compact,
}: ComandaPaymentPanelProps) {
  const [confirming, setConfirming] = useState<ComandaPaymentMethod | null>(null)
  const [error, setError] = useState('')

  async function handleConfirm(method: ComandaPaymentMethod) {
    if (confirming) return
    setConfirming(method)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(json.error ?? 'No se pudo confirmar el pago'); return }
      onConfirmed(method)
    } catch {
      setError('Error de conexión')
    } finally {
      setConfirming(null)
    }
  }

  if (paymentStatus === 'confirmed' && paymentMethod) {
    return (
      <div className="pt-1 border-t border-[var(--color-border)] flex items-center justify-between">
        <span className="text-[10px] font-body font-medium text-success flex items-center gap-1">
          ✓ {METHOD_LABEL_CONFIRMED[paymentMethod] ?? paymentMethod}
        </span>
        <button
          onClick={onPrint}
          className="text-[10px] text-text-muted hover:text-text transition-colors flex items-center gap-1"
          title="Reimprimir comanda y Nota de Venta"
        >
          <Printer size={11} />
          Reimprimir
        </button>
      </div>
    )
  }

  const options = companyId ? OPTIONS : OPTIONS.filter(o => o.id !== 'credito_b2b')

  return (
    <div className="pt-1 border-t border-[var(--color-border)] space-y-1.5">
      <p className="text-[10px] font-body font-semibold uppercase tracking-wide text-error">
        Pago sin coordinar
      </p>
      <div className={cn('grid gap-1', options.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => handleConfirm(opt.id)}
            disabled={!!confirming}
            style={compact ? { minHeight: 'var(--pos-hit-area-min)' } : undefined}
            className={cn('flex flex-col items-center justify-center gap-0.5 text-[10px] py-1.5 rounded transition-colors font-body font-medium disabled:opacity-50', opt.classes)}
            title={opt.id === 'credito_b2b' ? 'Cargar a la línea de crédito de la empresa' : undefined}
          >
            <opt.icon size={13} />
            {confirming === opt.id ? '...' : opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-error font-body">{error}</p>}
    </div>
  )
}

// Botón "Marcar listo para retirar" — pickup/metro, cualquier canal. Mismo
// criterio de extracción que el panel de pago de arriba.
interface ReadyButtonProps {
  apiUrl:   string
  orderId:  string
  readyAt:  string | null
  onMarked: () => void
  compact?: boolean
}

export function ComandaReadyButton({ apiUrl, orderId, readyAt, onMarked, compact }: ReadyButtonProps) {
  const [marking, setMarking] = useState(false)

  async function handleMark() {
    if (marking) return
    setMarking(true)
    try {
      const res = await fetch(`${apiUrl}/api/orders/${orderId}/ready`, { method: 'POST', credentials: 'include' })
      if (res.ok) onMarked()
    } finally {
      setMarking(false)
    }
  }

  if (readyAt) {
    return (
      <div className="pt-1 border-t border-[var(--color-border)]">
        <span className="text-[10px] font-body font-medium text-success flex items-center gap-1">
          <PackageCheck size={12} /> Listo para retirar — cliente avisado
        </span>
      </div>
    )
  }

  return (
    <div className="pt-1 border-t border-[var(--color-border)]">
      <button
        onClick={handleMark}
        disabled={marking}
        style={compact ? { minHeight: 'var(--pos-hit-area-min)' } : undefined}
        className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-body font-medium disabled:opacity-50"
      >
        <PackageCheck size={13} />
        {marking ? 'Avisando...' : 'Marcar listo para retirar'}
      </button>
    </div>
  )
}
