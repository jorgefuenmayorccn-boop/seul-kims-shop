'use client'
import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Check } from 'lucide-react'

interface Props {
  currentPin: string
  apiUrl:     string
}

export function PinMaestroSection({ currentPin, apiUrl }: Props) {
  const [pin,     setPin]     = useState(currentPin)
  const [show,    setShow]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (pin.trim().length < 4) { setError('El PIN debe tener al menos 4 caracteres'); return }
    setSaving(true); setError('')
    const r = await fetch(`${apiUrl}/api/tienda-config/void_pin`, {
      method:      'PUT',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ value: pin.trim() }),
    })
    setSaving(false)
    if (r.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError('Error al guardar')
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-5 text-brand" />
        <h2 className="text-lg font-semibold text-text">PIN maestro POS</h2>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-sm text-text-muted mb-4">
          El PIN maestro autoriza anulaciones de pedidos en el POS. Cámbialo regularmente.
        </p>
        <form onSubmit={handleSave} className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-text-muted mb-1">PIN actual</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={8}
                className="w-full px-3 py-2 pr-9 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Mínimo 4 caracteres"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{
              background: saved ? 'var(--color-dte-issued, #00C853)' : 'var(--color-brand)',
              color: '#fff',
            }}
          >
            {saved ? <><Check size={14} /> Guardado</> : saving ? 'Guardando…' : 'Guardar PIN'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </div>
    </section>
  )
}
