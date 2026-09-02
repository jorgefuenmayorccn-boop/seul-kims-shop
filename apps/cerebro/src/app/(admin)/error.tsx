'use client'
import { useEffect } from 'react'
import { ErrorState } from '@seul/ui'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  // El mensaje técnico (ej. "Cannot read properties of undefined") nunca se
  // muestra al usuario — solo se registra para depuración. Ver ErrorState.
  useEffect(() => { console.error('[cerebro/admin]', error) }, [error])

  return (
    <div className="flex items-center justify-center h-full p-8">
      <ErrorState
        title="No se pudo cargar esta sección"
        description="Intenta de nuevo. Si el problema continúa, avísale al equipo técnico."
        onRetry={reset}
        compact
      />
    </div>
  )
}
