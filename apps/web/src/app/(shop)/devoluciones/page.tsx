'use client'
import { useState } from 'react'
import { RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type ReturnType = 'defective' | 'wrong_item' | 'changed_mind' | 'other'

const TYPES: { value: ReturnType; label: string; desc: string }[] = [
  { value: 'defective',    label: 'Producto defectuoso', desc: 'Llegó dañado o en mal estado' },
  { value: 'wrong_item',   label: 'Producto incorrecto', desc: 'Nos equivocamos de producto' },
  { value: 'changed_mind', label: 'Arrepentimiento',     desc: 'Dentro de 10 días hábiles (Ley del Consumidor)' },
  { value: 'other',        label: 'Otro motivo',         desc: 'Explica en la descripción' },
]

export default function DevolucionesPage() {
  const [type, setType]       = useState<ReturnType>('defective')
  const [orderId, setOrderId] = useState('')
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok?: boolean; returnId?: string; error?: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res  = await fetch(`${API}/api/returns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId, type, reason }),
      })
      const data = await res.json() as typeof result
      setResult(data)
    } catch {
      setResult({ error: 'Error de conexión. Escríbenos a hola@seoulshop.cl.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <RotateCcw className="size-8 text-[var(--color-brand)]" />
        <div>
          <h1 className="text-2xl font-bold">Solicitar devolución</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Ley del Consumidor · Ley 19.496</p>
        </div>
      </div>

      {/* Política */}
      <div className="mb-8 rounded-lg bg-[var(--color-surface-sunken)] p-5 text-sm text-[var(--color-text-secondary)] space-y-2">
        <p>
          Aceptamos devoluciones por <strong className="text-[var(--color-text)]">producto defectuoso o incorrecto</strong> en
          cualquier momento. Para arrepentimiento, el plazo es <strong className="text-[var(--color-text)]">10 días hábiles</strong> desde
          la compra (Ley del Consumidor).
        </p>
        <p>
          Productos de <strong className="text-[var(--color-text)]">cadena de frío</strong> (congelados/refrigerados) solo son
          elegibles si el defecto es imputable a Seoul Shop.
        </p>
        <p>
          ¿Necesitas ayuda urgente?{' '}
          <a href="mailto:hola@seoulshop.cl" className="underline text-[var(--color-brand)]">Escríbenos por correo</a>.
        </p>
      </div>

      {result?.ok ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-[var(--color-baes-eligible)]" />
          <h2 className="mt-4 text-lg font-bold">Solicitud enviada</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            ID: <code className="font-mono text-xs">{result.returnId}</code>
          </p>
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Te contactaremos por correo en 1-2 días hábiles para coordinar la devolución.
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

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium mb-2">Motivo de devolución *</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TYPES.map(t => (
                <button
                  key={t.value} type="button" onClick={() => setType(t.value)}
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
            <label className="block text-sm font-medium mb-1.5">ID de tu pedido *</label>
            <input
              required value={orderId} onChange={e => setOrderId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm font-mono outline-none focus:border-[var(--color-brand)]"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Lo encuentras en el PDF de tu boleta o en el correo de confirmación.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Describe el problema *</label>
            <textarea
              required minLength={10} value={reason} onChange={e => setReason(e.target.value)} rows={4}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] resize-none"
              placeholder="Explica qué pasó con tu pedido…"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>
      )}
    </div>
  )
}
