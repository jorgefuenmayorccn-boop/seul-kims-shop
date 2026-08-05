import { cn } from './lib/utils'

type BAESStatus = 'eligible' | 'not-eligible' | 'applied' | 'partial'

interface BadgeBAESProps {
  status: BAESStatus
  studentName?: string
  className?: string
}

const labels: Record<BAESStatus, string> = {
  eligible:      'BAES',
  'not-eligible': 'No BAES',
  applied:       'BAES Aplicado',
  partial:       'BAES Parcial',
}

export function BadgeBAES({ status, studentName, className }: BadgeBAESProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold',
        status === 'eligible'      && 'bg-baes-eligible/10 text-baes-eligible border border-baes-eligible/30',
        status === 'not-eligible'  && 'bg-surface text-text-muted border border-border',
        status === 'applied'       && 'bg-baes-applied-bg text-[#1b5e20] border border-baes-eligible/40',
        status === 'partial'       && 'bg-warning/10 text-warning border border-warning/30',
        className
      )}
      title={studentName ? `Estudiante: ${studentName}` : undefined}
    >
      <span className="font-bold">B</span>
      {labels[status]}
      {studentName && status === 'applied' && (
        <span className="opacity-70">· {studentName}</span>
      )}
    </span>
  )
}
