import { cn } from './lib/utils'

type OrderStatus =
  | 'nueva' | 'preparando' | 'lista' | 'entregada' | 'cancelada'

type DTEStatus = 'dte-pending' | 'dte-issued' | 'dte-failed'

type StatusPillProps = {
  status: OrderStatus | DTEStatus
  className?: string
}

const config: Record<OrderStatus | DTEStatus, { label: string; className: string }> = {
  nueva:       { label: 'Nueva',     className: 'bg-orange-100 text-orange-700 border-orange-300' },
  preparando:  { label: 'Preparando',className: 'bg-warning/10 text-yellow-800 border-warning/40' },
  lista:       { label: 'Lista',     className: 'bg-success/10 text-success border-success/30' },
  entregada:   { label: 'Entregada', className: 'bg-surface text-text-muted border-border' },
  cancelada:   { label: 'Cancelada', className: 'bg-error-subtle text-error border-error/30' },
  'dte-pending': { label: 'DTE Pendiente', className: 'bg-warning/10 text-yellow-800 border-warning/40' },
  'dte-issued':  { label: 'DTE Emitida',   className: 'bg-success/10 text-success border-success/30' },
  'dte-failed':  { label: 'DTE Fallida',   className: 'bg-error-subtle text-error border-error/30 animate-pulse' },
}

export function StatusPill({ status, className }: StatusPillProps) {
  const { label, className: statusClass } = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusClass,
        className
      )}
    >
      {label}
    </span>
  )
}
