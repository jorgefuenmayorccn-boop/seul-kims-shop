'use client'
import { useEffect } from 'react'
import { Square } from 'lucide-react'
import { formatCLP } from '@seul/ui'

interface PostTillOptionsProps {
  totalSold:    number
  ticketCount:  number
  onNewTill:    () => void
  onCloseShift: () => void
  onViewHistory: () => void
  onDismiss?:   () => void
}

export function PostTillOptions({
  totalSold,
  ticketCount,
  onNewTill,
  onCloseShift,
  onViewHistory,
  onDismiss,
}: PostTillOptionsProps) {
  useEffect(() => {
    if (!onDismiss) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'var(--color-background)' }}
    >
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-8">
        <div className="text-center">
          <p className="font-korean font-black text-3xl mb-1" style={{ color: 'var(--color-brand)' }}>
            서울킴스
          </p>
          <p className="font-headline font-bold text-xl" style={{ color: 'var(--color-text)' }}>
            Caja cerrada
          </p>
        </div>

        {/* Resumen rápido */}
        <div
          className="w-full flex items-center justify-center gap-8 py-4 rounded-xl"
          style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
        >
          <div className="text-center">
            <p className="font-mono font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              {formatCLP(totalSold)}
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Total vendido
            </p>
          </div>
          <div className="w-px h-10" style={{ background: 'var(--color-border)' }} />
          <div className="text-center">
            <p className="font-mono font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              {ticketCount}
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {ticketCount === 1 ? 'Venta' : 'Ventas'}
            </p>
          </div>
        </div>

        {/* CTAs principales */}
        <div className="w-full grid grid-cols-2 gap-4">
          <button
            onClick={onNewTill}
            className="flex flex-col items-center gap-2 py-6 rounded-xl font-body font-semibold text-base transition-all active:scale-[0.98]"
            style={{
              background: 'var(--heuk-950, #0a0a0a)',
              color: '#f5f5f2',
            }}
          >
            <span className="text-2xl font-korean font-black" style={{ color: 'var(--color-brand)' }}>
              서울
            </span>
            Abrir nueva caja
          </button>

          <button
            onClick={onCloseShift}
            className="flex flex-col items-center gap-2 py-6 rounded-xl font-body font-semibold text-base transition-all active:scale-[0.98]"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '2px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Square size={24} />
            Cerrar turno
          </button>
        </div>

        {/* Link historial */}
        <button
          onClick={onViewHistory}
          className="font-body text-sm underline underline-offset-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Ver historial de ventas de esta caja
        </button>
      </div>
    </div>
  )
}
