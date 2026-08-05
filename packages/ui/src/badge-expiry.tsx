import { cn } from './lib/utils'

type ExpiryStatus = 'fresh' | 'warning' | 'urgent' | 'expired'

interface BadgeExpiryProps {
  expiresAt: Date
  className?: string
}

function getStatus(expiresAt: Date): ExpiryStatus {
  const days = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0)  return 'expired'
  if (days < 15) return 'urgent'
  if (days < 30) return 'warning'
  return 'fresh'
}

function formatDays(expiresAt: Date): string {
  const days = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0)  return 'Vencido'
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `${days}d`
}

const statusClass: Record<ExpiryStatus, string> = {
  fresh:   'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-[#7a6100] border-warning/40',
  urgent:  'bg-error-subtle text-error border-error/30',
  expired: 'bg-[#1a1a1a] text-white border-transparent',
}

export function BadgeExpiry({ expiresAt, className }: BadgeExpiryProps) {
  const status = getStatus(expiresAt)
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border',
        statusClass[status],
        className
      )}
    >
      {formatDays(expiresAt)}
    </span>
  )
}
