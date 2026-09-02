'use client'
import { useEffect } from 'react'
import { ErrorState } from '@seul/ui'

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // El mensaje técnico nunca se muestra al usuario — solo se registra para
  // depuración (ver ErrorState en @seul/ui).
  useEffect(() => { console.error('[web/shop]', error) }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <ErrorState
        description="Ocurrió un error inesperado en la tienda. Intenta de nuevo."
        onRetry={reset}
        supportHref="https://wa.me/56936451991"
      />
    </div>
  )
}
