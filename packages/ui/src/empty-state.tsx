import { cn } from './lib/utils'

type EmptyStateVariant =
  | 'no-orders'
  | 'no-stock'
  | 'no-results'
  | 'no-customers'
  | 'no-invoices'
  | 'no-alerts'

interface EmptyStateProps {
  variant: EmptyStateVariant
  action?: React.ReactNode
  className?: string
}

const content: Record<EmptyStateVariant, { emoji: string; title: string; description: string }> = {
  'no-orders':    { emoji: '📦', title: 'Sin pedidos todavía', description: 'Los pedidos nuevos aparecerán aquí.' },
  'no-stock':     { emoji: '🫙', title: 'Sin stock registrado', description: 'Agrega productos para comenzar.' },
  'no-results':   { emoji: '🔍', title: 'Sin resultados', description: 'Prueba con otro término de búsqueda.' },
  'no-customers': { emoji: '🙋', title: 'Sin clientes todavía', description: 'Los clientes aparecerán cuando hagan su primera compra.' },
  'no-invoices':  { emoji: '🧾', title: 'Sin facturas', description: 'Las facturas B2B generadas aparecerán aquí.' },
  'no-alerts':    { emoji: '✅', title: 'Todo en orden', description: 'Sin alertas de inventario ni vencimientos próximos.' },
}

export function EmptyState({ variant, action, className }: EmptyStateProps) {
  const { emoji, title, description } = content[variant]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <span className="text-4xl" role="img" aria-hidden>{emoji}</span>
      <div>
        <p className="font-headline font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted mt-1">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
