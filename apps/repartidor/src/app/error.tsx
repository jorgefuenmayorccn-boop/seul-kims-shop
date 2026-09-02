'use client'
import { useEffect } from 'react'
import { ErrorState } from '@seul/ui'

// No existía ningún error boundary en apps/repartidor (auditoría S15) — ver
// nota equivalente en apps/pos/src/app/error.tsx. El mensaje técnico nunca
// se muestra al usuario, solo se registra para depuración.
export default function RepartidorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[repartidor]', error) }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <ErrorState
        title="Hubo un problema"
        description="Intenta de nuevo. Si el problema sigue, avísale a tu supervisor."
        onRetry={reset}
      />
    </div>
  )
}
