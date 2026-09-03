'use client'
import { useState } from 'react'
import { AlertCircle, KeyRound, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function PinChangeForm() {
  const [pin1,    setPin1]    = useState('')
  const [pin2,    setPin2]    = useState('')
  const [status,  setStatus]  = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [error,   setError]   = useState('')

  async function save() {
    setError('')
    if (!/^\d{4}$/.test(pin1)) { setError('El PIN debe ser exactamente 4 dígitos'); return }
    if (pin1 !== pin2)          { setError('Los PINs no coinciden'); return }
    setStatus('saving')
    try {
      const res = await fetch(`${API_URL}/api/tienda-config/analytics_pin`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ value: pin1 }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Error ${res.status}`)
        setStatus('error')
        return
      }
      setStatus('ok')
      setPin1('')
      setPin2('')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setError('Error de conexión')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} />
        <h2 className="font-semibold">PIN de Analytics POS</h2>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Protege el acceso a la tab de ventas en el POS. PIN de 4 dígitos. Solo visible para cajeros que lo conozcan.
      </p>

      {status === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3 mb-4">
          <CheckCircle size={14} />
          <span>PIN actualizado correctamente</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3 mb-4">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-xs">
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Nuevo PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin1}
            onChange={e => { setPin1(e.target.value.replace(/\D/g, '')); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Confirmar PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin2}
            onChange={e => { setPin2(e.target.value.replace(/\D/g, '')); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none"
          />
        </div>
        <button
          onClick={save}
          disabled={status === 'saving'}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-brand)' }}
        >
          {status === 'saving' ? 'Guardando…' : 'Actualizar PIN'}
        </button>
      </div>
    </div>
  )
}

export default function AjustesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Configuración de la tienda
        </p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {/* PIN Analytics */}
        <PinChangeForm />

        {/* Estación Merval */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="font-semibold mb-3">Metro Merval — Punto de retiro</h2>
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>Confirmar estación con el dueño de SEUL SHOP CL. Se guarda en <code className="font-mono text-xs">tiendaConfig.metro_station_name</code></span>
          </div>
        </div>

        {/* DTE Provider */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="font-semibold mb-3">Proveedor DTE (Boleta Electrónica SII)</h2>
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>Elegir entre Bsale / Toku / Haulmer y configurar <code className="font-mono text-xs">DTE_API_KEY</code> y <code className="font-mono text-xs">DTE_RUT_EMPRESA</code> via <code className="font-mono text-xs">wrangler secret put</code></span>
          </div>
        </div>

        {/* Info tienda */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="font-semibold mb-3">Datos de la tienda (PDF boleta)</h2>
          <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <p>Dirección: <span className="text-amber-600 font-mono">CONFIRMAR CON DUEÑO</span></p>
            <p>RUT: <span className="text-amber-600 font-mono">CONFIRMAR CON DUEÑO</span></p>
            <p className="text-xs">Editar en <code className="font-mono">packages/pdf-templates/src/constants.ts → STORE_INFO</code></p>
          </div>
        </div>

      </div>
    </div>
  )
}
