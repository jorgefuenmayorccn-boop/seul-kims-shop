'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function SolicitudCreditoPage() {
  const [companyId, setCompanyId] = useState('')
  const [amountClp, setAmountClp] = useState('')
  const [reason,    setReason]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [sent,      setSent]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId.trim() || !amountClp || !reason.trim()) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/b2b/credit-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyId.trim(), amountClp: parseInt(amountClp), reason }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Error al enviar solicitud'); return }
      setSent(true)
    } catch {
      setError('Error de conexión')
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
          Revisaremos tu solicitud y actualizaremos tu wallet en 24–48 horas hábiles.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold mb-2">Solicitar crédito</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Solicita una recarga de tu wallet de crédito B2B. Un administrador revisará tu solicitud.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">ID de tu empresa</label>
          <input
            required value={companyId}
            onChange={e => setCompanyId(e.target.value)}
            placeholder="UUID de la empresa"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Monto solicitado (CLP)</label>
          <input
            required type="number" min="1000" step="1000" value={amountClp}
            onChange={e => setAmountClp(e.target.value)}
            placeholder="Ej: 500000"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Motivo</label>
          <textarea
            required rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="¿Por qué necesitas este crédito?"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] resize-none"
          />
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-brand)', color: '#fff' }}>
          {loading ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  )
}
