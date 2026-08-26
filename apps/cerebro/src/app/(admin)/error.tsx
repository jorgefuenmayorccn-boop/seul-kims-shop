'use client'
import { AlertTriangle } from 'lucide-react'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-error-subtle)' }}>
        <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
      </div>
      <div className="text-center">
        <p className="font-headline font-bold text-sm" style={{ color: 'var(--color-text)' }}>Algo salió mal</p>
        <p className="text-xs font-body mt-1" style={{ color: 'var(--color-text-muted)' }}>{error.message || 'No se pudo cargar esta sección'}</p>
      </div>
      <button onClick={reset} className="px-4 py-2 rounded text-xs font-semibold font-body transition-colors"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
        Reintentar
      </button>
    </div>
  )
}
