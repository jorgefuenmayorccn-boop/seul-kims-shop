'use client'
import { useEffect, useState } from 'react'
import { Building2, Check, X, TrendingUp, Paperclip, Upload, Loader2 } from 'lucide-react'
import { formatCLP } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface Solicitud {
  id:                string
  companyId:         string
  amountClp:         number
  approvedAmountClp: number | null
  commissionPct:     number | null
  commissionClp:     number | null
  reason:            string | null
  status:            'pending' | 'approved' | 'rejected'
  reviewedAt:        string | null
  reviewerNote:      string | null
  createdAt:         string
  razonSocial:       string
  rut:               string
  tier:              string
}

interface CreditDocument {
  id:           string
  originalName: string
  url:          string
  uploadedAt:   string
}

interface CreditSuggestion {
  companyId:        string
  razonSocial:      string
  rut:              string
  tier:             string
  currentLimitClp:  number
  creditUsedClp:    number
  walletBalanceClp: number
  recentTotalClp:   number
  priorTotalClp:    number
  growthPct:        number
  suggestedLimitClp: number
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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface PendingCompany {
  id:           string
  razonSocial:  string
  rut:          string
  giro:         string | null
  address:      string | null
  tier:         string
  createdAt:    string
  contactName:  string
  contactEmail: string
}

// Sección "Empresas B2B pendientes de aprobación" — GAP REAL cerrado hoy
// (2-sep-2026): antes de esto NINGÚN endpoint listaba ni aprobaba el
// REGISTRO de una empresa nueva (b2b_companies.status) — esta pantalla solo
// tenía solicitudes de CRÉDITO. Una empresa recién registrada
// (POST /api/b2b/registro) quedaba 'pending' para siempre, invisible en
// cerebro. Solo owner puede aprobar/rechazar (mismo criterio que crédito).
function PendingCompanies() {
  const [items, setItems]     = useState<PendingCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string | null>(null)
  const [error, setError]     = useState('')

  function load() {
    setLoading(true)
    fetch(`${API}/api/b2b/companies-pending`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { companies: [] })
      .then((d: { companies?: PendingCompany[] }) => setItems(d.companies ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function review(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    setError('')
    try {
      const r = await fetch(`${API}/api/b2b/companies/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error'); return }
      load()
    } finally {
      setActing(null)
    }
  }

  if (loading || items.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="px-5 py-3 border-b border-amber-200">
        <h2 className="text-sm font-semibold text-amber-900">
          Empresas B2B pendientes de aprobación ({items.length})
        </h2>
      </div>
      {error && <p className="px-5 pt-2 text-xs text-red-700">{error}</p>}
      <div className="divide-y divide-amber-100">
        {items.map(comp => (
          <div key={comp.id} className="px-5 py-3 flex items-center justify-between text-sm gap-4">
            <div>
              <p className="font-medium text-text">{comp.razonSocial}</p>
              <p className="text-[11px] text-text-muted font-mono">{comp.rut} · {comp.giro ?? 'sin giro'}</p>
              <p className="text-[11px] text-text-muted">{comp.contactName} · {comp.contactEmail}</p>
              <p className="text-[10px] text-text-muted mt-0.5">Solicitado {fmt(comp.createdAt)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={acting === comp.id}
                onClick={() => review(comp.id, 'approved')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--color-brand)', color: '#fff' }}>
                <Check size={12}/> Aprobar
              </button>
              <button
                disabled={acting === comp.id}
                onClick={() => review(comp.id, 'rejected')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                <X size={12}/> Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Sección "Clientes sugeridos para revisión de crédito" — GET /api/b2b/credit-suggestions
// (owner-only, adición post-entrega). Compara volumen de compra B2B de los
// últimos 30 días vs. los 30 días anteriores; solo aparece si el crecimiento
// es real y el límite sugerido supera al límite actual — ver comentario del
// endpoint en packages/api/src/server.ts para el detalle del cálculo.
function CreditSuggestions() {
  const [items, setItems] = useState<CreditSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/b2b/credit-suggestions`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { suggestions: [] })
      .then((d: { suggestions?: CreditSuggestion[] }) => setItems(d.suggestions ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || items.length === 0 || !visible) return null

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-200">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-700" />
          <h2 className="text-sm font-semibold text-emerald-900">Clientes sugeridos para revisión de crédito</h2>
        </div>
        <button onClick={() => setVisible(false)} className="text-emerald-700 hover:text-emerald-900 text-xs">Ocultar</button>
      </div>
      <div className="divide-y divide-emerald-100">
        {items.map(s => (
          <div key={s.companyId} className="px-5 py-3 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-text">{s.razonSocial}</p>
              <p className="text-[11px] text-text-muted font-mono">{s.rut} · {s.tier}</p>
            </div>
            <div className="text-right">
              <p className="text-emerald-700 font-semibold text-xs">+{s.growthPct}% vs. 30 días anteriores</p>
              <p className="text-[11px] text-text-muted">
                {formatCLP(s.priorTotalClp)} → {formatCLP(s.recentTotalClp)} · límite actual {formatCLP(s.currentLimitClp)}
              </p>
              <p className="text-[11px] text-emerald-700">Sugerido: {formatCLP(s.suggestedLimitClp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Documentos de respaldo de una solicitud — GET/POST /api/b2b/credit-requests/:id/documents
// (adición post-entrega). Solo visible/editable dentro del panel "Revisar" de
// una solicitud pending.
function CreditDocuments({ requestId }: { requestId: string }) {
  const [docs, setDocs]       = useState<CreditDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState('')

  function load() {
    setLoading(true)
    fetch(`${API}/api/b2b/credit-requests/${requestId}/documents`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then((d: { documents?: CreditDocument[] }) => setDocs(d.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [requestId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('originalName', file.name)
      const r = await fetch(`${API}/api/b2b/credit-requests/${requestId}/documents`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Error al subir documento')
      }
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir documento')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Documentos de respaldo</p>
      {loading ? (
        <p className="text-xs text-text-muted">Cargando…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-text-muted">Sin documentos subidos.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map(d => (
            <li key={d.id}>
              <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-brand hover:underline">
                <Paperclip size={11} /> {d.originalName}
              </a>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand cursor-pointer">
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? 'Subiendo…' : 'Subir documento (PDF/JPG/PNG)'}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={uploading} onChange={handleUpload} />
      </label>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}

export default function SolicitudesPage() {
  const [items,    setItems]    = useState<Solicitud[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [note,     setNote]     = useState('')
  const [approvedAmount, setApprovedAmount] = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('pending')
  const [isOwner,  setIsOwner]  = useState<boolean | null>(null)

  // PATCH .../review ahora exige rol `owner` (adición post-entrega, pedido
  // explícito del dueño: "solo el jefe/gerente puede aprobar"). `admin` sigue
  // viendo esta pantalla completa (GET /api/b2b/solicitudes acepta owner+admin)
  // pero los botones Aprobar/Rechazar se ocultan para evitar un 403 al hacer
  // clic — se muestra una nota explicando por qué en su lugar.
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { user?: { role?: string } } | null) => setIsOwner(d?.user?.role === 'owner'))
      .catch(() => setIsOwner(false))
  }, [])

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

  function startReview(item: Solicitud) {
    setReviewing(reviewing === item.id ? null : item.id)
    setApprovedAmount(String(item.amountClp))
    setNote('')
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    setSaving(id)
    setError('')
    const r = await fetch(`${API}/api/b2b/credit-requests/${id}/review`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        status,
        reviewerNote: note || undefined,
        ...(status === 'approved' ? { approvedAmountClp: Number(approvedAmount) || undefined } : {}),
      }),
    })
    setSaving(null); setReviewing(null); setNote('')
    if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error'); return }
    load()
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Building2 size={22}/>B2B — Solicitudes de Crédito</h1>
        <p className="mt-1 text-sm text-text-muted">
          Aprobar o rechazar solicitudes de recarga de wallet. Solo <strong>owner</strong> puede aprobar/rechazar
          — puedes ajustar el monto aprobado (mín. $100.000) y se calcula una comisión automática sobre el monto aprobado.
        </p>
      </div>

      <PendingCompanies />
      <CreditSuggestions />

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
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-sm">
                    {formatCLP(item.amountClp)}
                    {item.approvedAmountClp !== null && item.approvedAmountClp !== item.amountClp && (
                      <p className="text-[10px] text-emerald-700 font-normal">aprobado: {formatCLP(item.approvedAmountClp)}</p>
                    )}
                    {item.commissionClp !== null && (
                      <p className="text-[10px] text-text-muted font-normal">comisión {item.commissionPct}%: {formatCLP(item.commissionClp)}</p>
                    )}
                  </td>
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
                    {item.status === 'pending' && isOwner && (
                      <button onClick={() => startReview(item)}
                        className="text-xs text-text-muted hover:text-brand transition-colors">
                        Revisar
                      </button>
                    )}
                    {item.status === 'pending' && isOwner === false && (
                      <span className="text-[10px] text-text-muted italic">Solo owner puede aprobar</span>
                    )}
                  </td>
                </tr>
                {reviewing === item.id && isOwner && (
                  <tr key={`${item.id}-review`} className="bg-[var(--color-surface)]">
                    <td colSpan={6} className="px-8 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
                              Monto a aprobar (mín. $100.000) — puede ser distinto al solicitado
                            </label>
                            <input
                              type="number"
                              min={100000}
                              step={1000}
                              value={approvedAmount}
                              onChange={e => setApprovedAmount(e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                            />
                          </div>
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Nota (opcional)…"
                            rows={2}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-text resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                          <div className="flex gap-2">
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
                        <CreditDocuments requestId={item.id} />
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
