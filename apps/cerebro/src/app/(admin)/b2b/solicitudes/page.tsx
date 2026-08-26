'use client'
import { useEffect, useState } from 'react'
import { Building2, Check, X } from 'lucide-react'
import { formatCLP } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface Solicitud {
  id:           string
  companyId:    string
  amountClp:    number
  reason:       string | null
  status:       'pending' | 'approved' | 'rejected'
  reviewedAt:   string | null
  reviewerNote: string | null
  createdAt:    string
  razonSocial:  string
  rut:          string
  tier:         string
}

const STATUS_LABELS = {
  pending:  'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

const STATUS_COLORS = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function SolicitudesPage() {
  const [items,    setItems]    = useState<Solicitud[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [note,     setNote]     = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('pending')

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/b2b/solicitudes?status=${filter}`, { credentials: 'include' })
      const d = await r.json() as { solicitudes?: Solicitud[] }
      setItems(d.solicitudes ?? [])
    } catch {
      setError('No se pudo cargar las solicitudes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  async function review(id: string, status: 'approved' | 'rejected') {
    setSaving(id)
    const r = await fetch(`${API}/api/b2b/credit-requests/${id}/review`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status, reviewerNote: note || undefined }),
    })
    setSaving(null); setReviewing(null); setNote('')
    if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error'); return }
    load()
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Building2 size={22}/>B2B — Solicitudes de Crédito</h1>
        <p className="mt-1 text-sm text-text-muted">Aprobar o rechazar solicitudes de recarga de wallet</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? 'bg-brand text-white' : 'bg-surface text-text-muted hover:text-text'}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Empresa</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Monto</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Motivo</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Fecha</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-text-muted">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-text-muted">Sin solicitudes</td></tr>
            ) : items.map(item => (
              <>
                <tr key={item.id} className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-text text-xs">{item.razonSocial}</p>
                    <p className="text-[10px] text-text-muted font-mono">{item.rut} · {item.tier}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-sm">{formatCLP(item.amountClp)}</td>
                  <td className="px-5 py-3.5 text-xs text-text-muted max-w-xs">
                    <p className="truncate">{item.reason ?? '—'}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-text-muted font-mono">{fmt(item.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.reviewerNote && (
                      <p className="text-[10px] text-text-muted mt-0.5 italic">{item.reviewerNote}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {item.status === 'pending' && (
                      <button onClick={() => setReviewing(reviewing === item.id ? null : item.id)}
                        className="text-xs text-text-muted hover:text-brand transition-colors">
                        Revisar
                      </button>
                    )}
                  </td>
                </tr>
                {reviewing === item.id && (
                  <tr key={`${item.id}-review`} className="bg-[var(--color-surface)]">
                    <td colSpan={6} className="px-8 py-4">
                      <div className="flex items-start gap-3">
                        <textarea
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Nota (opcional)…"
                          rows={2}
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-text resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                        <div className="flex flex-col gap-2">
                          <button
                            disabled={saving === item.id}
                            onClick={() => review(item.id, 'approved')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: 'var(--color-brand)', color: '#fff' }}>
                            <Check size={12}/> Aprobar
                          </button>
                          <button
                            disabled={saving === item.id}
                            onClick={() => review(item.id, 'rejected')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                            <X size={12}/> Rechazar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
