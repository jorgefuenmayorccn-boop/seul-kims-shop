import { cn } from './lib/utils'
import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  /** Título corto, siempre copy en español natural — nunca un mensaje técnico. */
  title?: string
  /**
   * Descripción para el usuario. NUNCA pasar aquí `error.message` u otro texto
   * crudo de una excepción (ej. "Cannot read properties of undefined") — este
   * componente existe justamente para reemplazar esos mensajes. Si necesitas
   * el detalle técnico para depurar, regístralo con `console.error` en el
   * `error.tsx`/`catch` que llama a este componente, no lo pases como prop.
   */
  description?: string
  onRetry?: () => void
  retryLabel?: string
  supportHref?: string
  supportLabel?: string
  /** Espaciado reducido para usarlo dentro de una tarjeta/sección, no a pantalla completa. */
  compact?: boolean
  className?: string
}

export function ErrorState({
  title = 'Algo salió mal',
  description = 'No pudimos completar esta acción. Intenta de nuevo en unos segundos.',
  onRetry,
  retryLabel = 'Reintentar',
  supportHref,
  supportLabel = 'Contactar soporte',
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-8' : 'py-16',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-error-subtle">
        <AlertTriangle size={20} className="text-error" />
      </div>
      <div>
        <p className="font-headline font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted mt-1 max-w-xs">{description}</p>
      </div>
      {(onRetry || supportHref) && (
        <div className="flex gap-2 mt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded text-xs font-semibold font-body bg-surface border border-[var(--color-border)] text-text transition-colors hover:bg-elevated"
            >
              {retryLabel}
            </button>
          )}
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded text-xs font-semibold font-body bg-brand text-text-on-brand transition-opacity hover:opacity-90"
            >
              {supportLabel}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
