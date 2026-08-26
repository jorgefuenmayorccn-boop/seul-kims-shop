'use client'
import { cn } from '../lib/utils'
import { formatCLP } from '../lib/utils'

interface CreditGaugeProps {
  limitClp: number
  usedClp:  number
  className?: string
}

export function CreditGauge({ limitClp, usedClp, className }: CreditGaugeProps) {
  const pct     = limitClp > 0 ? Math.min(Math.round((usedClp / limitClp) * 100), 100) : 0
  const availableClp = limitClp - usedClp

  const barColor =
    pct >= 90 ? 'bg-[var(--color-dte-failed)]' :
    pct >= 70 ? 'bg-[var(--color-expiry-warning)]' :
    'bg-[var(--color-baes-eligible)]'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Crédito disponible</span>
        <span className="font-semibold tabular-nums">{formatCLP(availableClp)}</span>
      </div>

      <div className="h-3 w-full rounded-full bg-[var(--color-surface-sunken)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
        <span>Usado: {formatCLP(usedClp)}</span>
        <span>{pct}% del límite {formatCLP(limitClp)}</span>
      </div>
    </div>
  )
}
