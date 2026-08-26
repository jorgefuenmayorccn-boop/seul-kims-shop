'use client'
import { cn } from './lib/utils'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

type ARCOPType = 'access' | 'rectification' | 'deletion' | 'portability'

const TYPE_LABEL: Record<ARCOPType, string> = {
  access:         'Acceso',
  rectification:  'Rectificación',
  deletion:       'Supresión',
  portability:    'Portabilidad',
}

interface ARCOPCountdownProps {
  type:      ARCOPType
  deadline:  string   // ISO date string
  status:    string
  className?: string
}

export function ARCOPCountdown({ type, deadline, status, className }: ARCOPCountdownProps) {
  const deadlineDate = new Date(deadline)
  const msLeft       = deadlineDate.getTime() - Date.now()
  const daysLeft     = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  const isResolved   = status === 'resolved' || status === 'rejected'
  const isUrgent     = !isResolved && daysLeft <= 3
  const isExpired    = !isResolved && daysLeft < 0

  const color =
    isResolved ? 'text-[var(--color-text-secondary)]' :
    isExpired  ? 'text-[var(--color-dte-failed)]' :
    isUrgent   ? 'text-[var(--color-expiry-urgent)]' :
    'text-[var(--color-text-secondary)]'

  const Icon =
    isResolved ? CheckCircle2 :
    isUrgent || isExpired ? AlertTriangle :
    Clock

  return (
    <div className={cn('flex items-center gap-2 text-xs', color, className)}>
      <Icon className="size-3.5 shrink-0" />
      <span>
        {TYPE_LABEL[type]} —{' '}
        {isResolved
          ? 'Resuelta'
          : isExpired
          ? `Vencida hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? 's' : ''}`
          : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} hábil${daysLeft !== 1 ? 'es' : ''} restante${daysLeft !== 1 ? 's' : ''}`
        }
      </span>
    </div>
  )
}
