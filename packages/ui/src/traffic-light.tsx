import { cn } from './lib/utils'

type TrafficStatus = 'fresh' | 'warning' | 'urgent' | 'expired'

interface TrafficLightProps {
  status: TrafficStatus
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean   // pulso animado para "expired"
  className?: string
}

const sizeClass: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

const colorClass: Record<TrafficStatus, string> = {
  fresh:   'bg-success',
  warning: 'bg-warning',
  urgent:  'bg-error',
  expired: 'bg-[var(--ink-900)]',
}

const label: Record<TrafficStatus, string> = {
  fresh:   'Fresco (>30 días)',
  warning: 'Próximo a vencer (15–30 días)',
  urgent:  'Vence pronto (<15 días)',
  expired: 'VENCIDO — retirar de góndola',
}

export function TrafficLight({ status, size = 'md', pulse, className }: TrafficLightProps) {
  const shouldPulse = pulse ?? status === 'expired'
  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        sizeClass[size],
        colorClass[status],
        shouldPulse && 'animate-pulse',
        className
      )}
      title={label[status]}
      aria-label={label[status]}
    />
  )
}

// Versión con 3 círculos apilados (semáforo visual completo)
export function TrafficLightStack({ status }: { status: TrafficStatus }) {
  return (
    <div className="flex flex-col gap-1 items-center" aria-label={label[status]}>
      <span className={cn('w-3 h-3 rounded-full', status === 'fresh' ? 'bg-success' : 'bg-success/20')} />
      <span className={cn('w-3 h-3 rounded-full', status === 'warning' ? 'bg-warning' : 'bg-warning/20')} />
      <span className={cn('w-3 h-3 rounded-full', status === 'urgent' || status === 'expired' ? 'bg-error' : 'bg-error/20')} />
    </div>
  )
}
