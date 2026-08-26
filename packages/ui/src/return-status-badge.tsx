'use client'
import { cn } from './lib/utils'
import { Clock, CheckCircle2, XCircle, PackageCheck } from 'lucide-react'

type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'processed'
type ReturnType   = 'defective' | 'wrong_item' | 'changed_mind' | 'other'

const STATUS_CONFIG: Record<ReturnStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  pending:   { label: 'En revisión',  icon: <Clock className="size-3.5" />,        cls: 'bg-[var(--color-dte-pending)]/15 text-amber-700' },
  approved:  { label: 'Aprobada',     icon: <CheckCircle2 className="size-3.5" />, cls: 'bg-[var(--color-baes-eligible)]/15 text-emerald-700' },
  rejected:  { label: 'Rechazada',    icon: <XCircle className="size-3.5" />,      cls: 'bg-[var(--color-dte-failed)]/15 text-[var(--color-dte-failed)]' },
  processed: { label: 'Procesada',    icon: <PackageCheck className="size-3.5" />, cls: 'bg-blue-100 text-blue-700' },
}

const TYPE_LABEL: Record<ReturnType, string> = {
  defective:    'Producto defectuoso',
  wrong_item:   'Producto incorrecto',
  changed_mind: 'Arrepentimiento',
  other:        'Otro motivo',
}

interface ReturnStatusBadgeProps {
  status:    ReturnStatus
  type?:     ReturnType
  className?: string
}

export function ReturnStatusBadge({ status, type, className }: ReturnStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', config.cls)}>
        {config.icon}
        {config.label}
      </span>
      {type && (
        <span className="text-xs text-[var(--color-text-secondary)]">{TYPE_LABEL[type]}</span>
      )}
    </div>
  )
}
