'use client'
import { useState } from 'react'
import { Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type ARCOPType = 'access' | 'rectification' | 'deletion' | 'portability'

const TYPES: { value: ARCOPType; label: string; desc: string }[] = [
  { value: 'access',        label: 'Acceso',        desc: 'Saber qué datos tenemos sobre ti' },
  { value: 'rectification', label: 'Rectificación', desc: 'Corregir datos incorrectos' },
  { value: 'deletion',      label: 'Supresión',     desc: 'Eliminar tus datos personales' },
  { value: 'portability',   label: 'Portabilidad',  desc: 'Recibir tus datos en formato digital' },
]

export default function PrivacidadPage() {
  const [type, setType]       = useState<ARCOPType>('access')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; deadline?: string; requestId?: string; error?: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res  = await fetch(`${API}/api/arcop`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, name, email, notes }),
      })
      const data = await res.json() as typeof result
      setResult(data)
    } catch {
      setResult({ ok: false, error: 'Error de conexión. Intenta más tarde.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Shield className="size-8 text-[var(--color-brand)]" />
        <div>
          <h1 className="text-2xl font-bold">Privacidad y datos personales</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Ley 21.719 — Chile</p>
        </div>
      </div>

      {/* Info legal */}
      <div className="mb-8 rounded-lg bg-[var(--color-surface-sunken)] p-5 text-sm text-[var(--color-text-secondary)] space-y-2">
        <p>
          En Seoul Kims tratamos tus datos con responsabilidad. Tienes derecho a acceder, rectificar,
          suprimir o portar tus datos personales conforme a la <strong className="text-[var(--color-text)]">Ley 21.719</strong>.
        </p>
        <p>
          Respondemos todas las solicitudes en un plazo máximo de <strong className="text-[var(--color-text)]">15 días hábiles</strong>.
        </p>
      </div>

      {result?.ok ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-[var(--color-baes-eligible)]" />
          <h2 className="mt-4 text-lg font-bold">Solicitud registrada</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            ID: <code className="font-mono text-xs">{result.requestId}</code>
          </p>
          {result.deadline && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Fecha límite de respuesta:{' '}
              <strong className="text-[var(--color-text)]">
                {new Date(result.deadline).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
              </strong>
            </p>
          )}
          <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
            Te responderemos al email indicado. Si tienes dudas, escríbenos a{' '}
            <a href="mailto:hola@seoulshop.cl" className="underline text-[var(--color-brand)]">hola@seoulshop.cl</a>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
          {result?.error && (
            <div className="flex items-start gap-2 rounded-lg bg-[var(--color-dte-failed)]/10 p-3 text-sm text-[var(--color-dte-failed)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {result.error}
            </div>
          )}

          {/* Tipo de solicitud */}
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de solicitud *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={[
                    'rounded-lg border p-3 text-left text-sm transition-colors',
                    type === t.value
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 font-semibold text-[var(--color-brand)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]',
                  ].join(' ')}
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre completo *</label>
            <input
              required value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
              placeholder="María González"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email *</label>
            <input
              required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Descripción de tu solicitud *</label>
            <textarea
              required minLength={10} value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] resize-none"
              placeholder="Describe detalladamente lo que necesitas…"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>

          <p className="text-center text-xs text-[var(--color-text-secondary)]">
            Tus datos se usan únicamente para responder esta solicitud.
          </p>
        </form>
      )}
    </div>
  )
}
