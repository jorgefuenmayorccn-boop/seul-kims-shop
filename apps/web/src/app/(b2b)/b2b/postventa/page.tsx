'use client'
import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type IssueType = 'return' | 'exchange' | 'complaint' | 'missing_item'

const ISSUE_LABELS: Record<IssueType, string> = {
  return:       'Devolución de producto',
  exchange:     'Cambio de producto',
  complaint:    'Reclamo / calidad',
  missing_item: 'Producto faltante',
}

// Adición post-entrega (3-sep-2026) — esta pantalla nunca guardaba nada, solo
// abría un link de WhatsApp con el mensaje armado (cero persistencia). Ahora
// envía de verdad a POST /api/b2b/postventa (queda guardado + avisa al staff
// por correo).
export default function PostventaB2BPage() {
  const [form, setForm] = useState({
    orderNumber: '', issueType: 'return' as IssueType, description: '', contactPhone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) { setError('Describe el problema'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch(`${API}/api/b2b/postventa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'No se pudo enviar la solicitud.')
        return
      }
      setSent(true)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <CheckCircle2 className="mx-auto size-16 text-[var(--color-baes-eligible)]" />
        <h1 className="mt-4 text-2xl font-bold">Solicitud enviada</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Recibimos tu solicitud. Te contactaremos por correo en horario hábil.
        </p>
      </div>
    )
  }

  const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]'

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold mb-2">Postventa B2B</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Gestiona devoluciones, cambios y reclamos de tus pedidos mayoristas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Tipo de solicitud</label>
          <select
            value={form.issueType}
            onChange={e => setForm(p => ({ ...p, issueType: e.target.value as IssueType }))}
            className={inputClass}>
            {(Object.entries(ISSUE_LABELS) as [IssueType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Número de pedido (opcional)</label>
          <input
            type="text" value={form.orderNumber}
            onChange={e => setForm(p => ({ ...p, orderNumber: e.target.value }))}
            placeholder="Ej: 1042"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Descripción del problema</label>
          <textarea
            required rows={4} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Describe detalladamente el problema…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Teléfono de contacto (opcional)</label>
          <input
            type="tel" value={form.contactPhone}
            onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
            placeholder="+56 9 …"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-brand)', color: '#fff' }}>
          {loading
            ? <Loader2 className="mx-auto size-4 animate-spin" />
            : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  )
}
