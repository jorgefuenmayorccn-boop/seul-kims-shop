import { cn } from './lib/utils'

// Ley 20.606 — Sellos "Alto En"
type SelloType = 'sodio' | 'grasas' | 'azucares' | 'calorias'

interface BadgeNutritionProps {
  sellos: SelloType[]
  size?: 'sm' | 'md'
  className?: string
}

const labels: Record<SelloType, string> = {
  sodio:    'ALTO EN SODIO',
  grasas:   'ALTO EN GRASAS SATURADAS',
  azucares: 'ALTO EN AZÚCARES',
  calorias: 'ALTO EN CALORÍAS',
}

function SelloAltoEn({ sello, size = 'md' }: { sello: SelloType; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-[var(--color-alto-en-bg)] text-[var(--color-alto-en-text)]',
        'border-2 border-[var(--color-alto-en-bg)] font-mono font-bold text-center leading-tight',
        size === 'sm' ? 'px-2 py-1 text-[9px] rounded-sm' : 'px-3 py-2 text-[11px] rounded-md'
      )}
      title={`Sello Ley 20.606: ${labels[sello]}`}
    >
      {labels[sello]}
    </div>
  )
}

export function BadgeNutrition({ sellos, size = 'md', className }: BadgeNutritionProps) {
  if (!sellos.length) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {sellos.map(sello => (
        <SelloAltoEn key={sello} sello={sello} size={size} />
      ))}
    </div>
  )
}
