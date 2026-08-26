'use client'
import { AlertCircle } from '@seul/icons'

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="size-12 text-[var(--color-dte-failed)]" />
      <h2 className="font-headline text-2xl font-bold text-text">Algo salió mal</h2>
      <p className="font-body text-text-muted max-w-sm">
        {error.message || 'Ocurrió un error inesperado en la tienda.'}
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          Reintentar
        </button>
        <a
          href="https://wa.me/56936451991"
          className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 font-semibold hover:bg-[var(--color-surface-raised)]"
        >
          Contactar soporte
        </a>
      </div>
    </div>
  )
}
