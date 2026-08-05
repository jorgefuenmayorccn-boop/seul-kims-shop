'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, CreditCard } from 'lucide-react'
import { cn } from '../lib/utils'

interface BAESValidatorProps {
  onValidated: (student: { name: string; rut: string } | null) => void
}

type State = 'idle' | 'loading' | 'valid' | 'invalid'

export function BAESValidator({ onValidated }: BAESValidatorProps) {
  const [tne, setTne] = useState('')
  const [state, setState] = useState<State>('idle')
  const [studentName, setStudentName] = useState('')

  async function validate() {
    if (!tne || state === 'loading') return
    setState('loading')

    try {
      // Llamada a API que valida TNE con JUNAEB
      // En v1.0: validación manual o lookup en tabla local de TNEs autorizadas
      const res = await fetch(`/api/baes/validate?tne=${encodeURIComponent(tne)}`)
      const data = await res.json() as { valid: boolean; name?: string; rut?: string }

      if (data.valid && data.name && data.rut) {
        setState('valid')
        setStudentName(data.name)
        onValidated({ name: data.name, rut: data.rut })
      } else {
        setState('invalid')
        onValidated(null)
      }
    } catch {
      setState('invalid')
      onValidated(null)
    }
  }

  function clear() {
    setTne('')
    setState('idle')
    setStudentName('')
    onValidated(null)
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide font-body">
        Tarjeta TNE — Validar BAES JUNAEB
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={tne}
          onChange={e => setTne(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && validate()}
          placeholder="Escanear o ingresar TNE"
          disabled={state === 'valid' || state === 'loading'}
          className={cn(
            'flex-1 font-mono text-sm px-3 py-2.5 rounded-md border',
            'bg-elevated text-text placeholder:text-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
            state === 'valid' && 'border-baes-eligible bg-[var(--color-baes-applied-bg)]',
            state === 'invalid' && 'border-error bg-error-subtle',
            (state === 'idle' || state === 'loading') && 'border-[var(--color-border)]',
          )}
        />
        <button
          onClick={state === 'valid' ? clear : validate}
          disabled={state === 'loading' || (!tne && state === 'idle')}
          className={cn(
            'min-h-[var(--pos-hit-area-min)] px-4 rounded-md font-body font-semibold text-sm transition-colors',
            state === 'valid'
              ? 'bg-error/10 text-error hover:bg-error/20'
              : 'bg-brand text-white hover:bg-brand-hover disabled:opacity-40',
          )}
        >
          {state === 'loading' && <Loader2 size={16} className="animate-spin" />}
          {state === 'valid' && 'Quitar'}
          {state === 'invalid' && 'Reintentar'}
          {state === 'idle' && <CreditCard size={16} />}
        </button>
      </div>

      {/* Feedback */}
      {state === 'valid' && (
        <div className="flex items-center gap-2 text-[var(--color-baes-applied-text)] bg-[var(--color-baes-applied-bg)] px-3 py-2 rounded-md">
          <CheckCircle size={14} className="text-baes-eligible shrink-0" />
          <span className="text-sm font-semibold font-body">BAES activo · {studentName}</span>
        </div>
      )}
      {state === 'invalid' && (
        <div className="flex items-center gap-2 text-error bg-error-subtle px-3 py-2 rounded-md">
          <XCircle size={14} className="shrink-0" />
          <span className="text-sm font-body">TNE no válida o no registrada en JUNAEB</span>
        </div>
      )}
    </div>
  )
}
