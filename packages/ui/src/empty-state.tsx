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
  /** Sobrescribe el título del preset — para reusar el mismo componente/ícono
      en una pantalla cuyo copy no coincide exactamente con ningún variant. */
  title?: string
  /** Sobrescribe la descripción del preset. */
  description?: string
  action?: React.ReactNode
  className?: string
}

// SVG icons inline — sin dependencia de @seul/icons para evitar loops
function IconOrders() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity="0.3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}
function IconStock() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
function IconCustomers() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconInvoices() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
function IconAlerts() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const content: Record<EmptyStateVariant, { icon: React.ReactNode; title: string; description: string }> = {
  'no-orders':    { icon: <IconOrders />,    title: 'Sin pedidos todavía',    description: 'Los pedidos nuevos aparecerán aquí.' },
  'no-stock':     { icon: <IconStock />,     title: 'Sin stock registrado',   description: 'Agrega productos para comenzar.' },
  'no-results':   { icon: <IconSearch />,    title: 'Sin resultados',         description: 'Prueba con otro término de búsqueda.' },
  'no-customers': { icon: <IconCustomers />, title: 'Sin clientes todavía',   description: 'Los clientes aparecerán cuando hagan su primera compra.' },
  'no-invoices':  { icon: <IconInvoices />,  title: 'Sin facturas',           description: 'Las facturas B2B generadas aparecerán aquí.' },
  'no-alerts':    { icon: <IconAlerts />,    title: 'Todo en orden',          description: 'Sin alertas de inventario ni vencimientos próximos.' },
}

export function EmptyState({ variant, title, description, action, className }: EmptyStateProps) {
  const preset = content[variant]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <span className="text-text-muted">{preset.icon}</span>
      <div>
        <p className="font-headline font-semibold text-text">{title ?? preset.title}</p>
        <p className="text-sm text-text-muted mt-1">{description ?? preset.description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
