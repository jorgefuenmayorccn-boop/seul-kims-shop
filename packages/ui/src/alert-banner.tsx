import { cn } from './lib/utils'
import { AlertTriangle, XCircle, Info, X } from 'lucide-react'

type AlertSeverity = 'info' | 'warning' | 'critical'

interface AlertBannerProps {
  severity: AlertSeverity
  title: string
  description?: string
  onDismiss?: () => void
  className?: string
}

const config: Record<AlertSeverity, {
  icon: typeof AlertTriangle
  className: string
}> = {
  info:     { icon: Info,          className: 'bg-[var(--color-surface)] border-border text-text' },
  warning:  { icon: AlertTriangle, className: 'bg-warning/10 border-warning/40 text-[#7a6100]' },
  critical: { icon: XCircle,       className: 'bg-error-subtle border-error/40 text-error' },
}

export function AlertBanner({ severity, title, description, onDismiss, className }: AlertBannerProps) {
  const { icon: Icon, className: severityClass } = config[severity]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-md border',
        severityClass,
        className
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-body">{title}</p>
        {description && (
          <p className="text-xs mt-0.5 opacity-80 font-body">{description}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Cerrar alerta"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
