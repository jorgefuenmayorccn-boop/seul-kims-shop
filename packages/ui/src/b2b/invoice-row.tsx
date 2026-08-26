'use client'
import { cn, formatCLP } from '../lib/utils'
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

type DTEStatus = 'pending' | 'emitted' | 'dte-failed'
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

interface InvoiceRowProps {
  number:    number
  total:     number
  status:    OrderStatus
  dteStatus: DTEStatus
  dteFolio?: number | null
  createdAt: string
  className?: string
}

const DTE_ICON: Record<DTEStatus, React.ReactNode> = {
  pending:    <Clock className="size-4 text-[var(--color-text-secondary)]" />,
  emitted:    <CheckCircle2 className="size-4 text-[var(--color-baes-eligible)]" />,
  'dte-failed': <AlertCircle className="size-4 text-[var(--color-dte-failed)]" />,
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Pendiente',
  confirmed:  'Confirmado',
  preparing:  'Preparando',
  ready:      'Listo',
  delivered:  'Entregado',
  cancelled:  'Cancelado',
}

export function InvoiceRow({
  number, total, status, dteStatus, dteFolio, createdAt, className
}: InvoiceRowProps) {
  const date = new Date(createdAt).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className={cn(
      'flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3',
      className,
    )}>
      <FileText className="size-5 shrink-0 text-[var(--color-text-secondary)]" />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Pedido #{number}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{date}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-semibold tabular-nums text-sm">{formatCLP(total)}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{STATUS_LABEL[status]}</p>
      </div>

      <div className="shrink-0 flex items-center gap-1" title={`DTE: ${dteFolio ? `Folio ${dteFolio}` : dteStatus}`}>
        {DTE_ICON[dteStatus]}
      </div>
    </div>
  )
}
