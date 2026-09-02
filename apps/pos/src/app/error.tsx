'use client'
import { useEffect } from 'react'
import { ErrorState } from '@seul/ui'

// No existía ningún error boundary en apps/pos (auditoría S15) — cualquier
// excepción de render mostraba la pantalla de error genérica y sin estilo de
// Next.js directamente sobre la caja registradora. El mensaje técnico nunca
// se muestra al usuario, solo se registra para depuración.
export default function POSError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[pos]', error) }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <ErrorState
        title="El POS tuvo un problema"
        description="Intenta de nuevo. Si sigue fallando, avisa a soporte técnico antes de seguir cobrando."
        onRetry={reset}
        supportHref="https://wa.me/56936451991"
      />
    </div>
  )
}
