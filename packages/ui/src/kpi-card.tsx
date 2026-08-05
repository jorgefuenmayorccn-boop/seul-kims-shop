import { cn, formatCLP } from './lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  label: string
  value: number | string
  format?: 'clp' | 'number' | 'text'
  delta?: number | null       // % cambio vs período anterior
  variant?: 'default' | 'warning' | 'urgent' | 'success'
  className?: string
}

export function KPICard({ label, value, format = 'number', delta, variant = 'default', className }: KPICardProps) {
  const displayValue = format === 'clp'
    ? formatCLP(Number(value))
    : format === 'number'
      ? Number(value).toLocaleString('es-CL')
      : String(value)

  const DeltaIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaColor = delta == null ? '' : delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-text-muted'

  return (
    <div className={cn(
      'bg-elevated rounded-lg p-5 border border-[var(--color-border)] shadow-sm',
      variant === 'warning' && 'border-warning/40 bg-warning/5',
      variant === 'urgent' && 'border-error/40 bg-error-subtle/50',
      variant === 'success' && 'border-success/30 bg-success/5',
      className
    )}>
      <p className="text-xs text-text-muted uppercase tracking-wide mb-2 font-body">
        {label}
      </p>
      <p className={cn(
        'font-mono text-2xl font-bold',
        variant === 'default' && 'text-text',
        variant === 'warning' && 'text-[var(--color-expiry-warning)]',
        variant === 'urgent' && 'text-error',
        variant === 'success' && 'text-success',
      )}>
        {displayValue}
      </p>
      {delta != null && DeltaIcon && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-body', deltaColor)}>
          <DeltaIcon size={12} />
          <span>{Math.abs(delta).toFixed(1)}% vs ayer</span>
        </div>
      )}
    </div>
  )
}
