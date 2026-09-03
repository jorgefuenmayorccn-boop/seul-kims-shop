'use client'
import { useEffect, useState, useCallback } from 'react'
import { History, ChevronLeft, ChevronRight } from 'lucide-react'
import { friendlyErrorMessage } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const PAGE_SIZE = 50

interface AuditEntry {
  id:           number
  actorUserId:  string | null
  actorEmail:   string | null
  actorRole:    string | null
  action:       string
  entityTable:  string | null
  entityId:     string | null
  details:      Record<string, any> | null
  ipAddress:    string | null
  userAgent:    string | null
  createdAt:    string
}

const ACTION_LABELS: Record<string, string> = {
  'user.create':               'Usuario creado',
  'user.update':                'Usuario editado',
  'user.role_change':          'Rol cambiado',
  'user.activate':              'Usuario activado',
  'user.deactivate':            'Usuario desactivado',
  'user.password_change_self':  'Cambio de contraseña propia',
  'tienda_config.update':       'Configuración de tienda editada',
  // Agregadas 3-sep-2026 (Fase 2 multilocal) — product.create/product.update
  // ya se registraban en audit_log desde antes, pero sin etiqueta en español
  // caían al texto crudo del action.
  'product.create':             'Producto creado',
  'product.update':             'Producto editado',
  'product.image_upload':       'Imagen de producto subida',
  'product.image_delete':       'Imagen de producto eliminada',
  'inventory.lot_create':       'Lote de inventario agregado',
  'inventory.adjust':           'Inventario ajustado',
  'order.void':                 'Venta anulada',
  'b2b_company.review':         'Empresa B2B revisada',
  'delivery.pod_upload':        'Comprobante de entrega subido',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export default function AuditoriaPage() {
  const [entries,  setEntries]  = useState<AuditEntry[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter,  setActorFilter]  = useState('')
  const [fromFilter,   setFromFilter]   = useState('')
  const [toFilter,     setToFilter]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (actionFilter) params.set('action', actionFilter)
      if (actorFilter)  params.set('actorEmail', actorFilter)
      if (fromFilter)   params.set('from', fromFilter)
      if (toFilter)     params.set('to', toFilter)

      const r = await fetch(`${API}/api/audit-log?${params.toString()}`, { credentials: 'include' })
      if (!r.ok) throw new Error('Error al cargar el registro de auditoría')
      const d = await r.json() as { entries: AuditEntry[]; total: number }
      setEntries(d.entries ?? [])
      setTotal(d.total ?? 0)
    } catch (err) {
      console.error('[cerebro/auditoria]', err)
      setError(friendlyErrorMessage(err instanceof Error ? err.message : undefined, 'Error de conexión'))
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, actorFilter, fromFilter, toFilter])

  useEffect(() => { load() }, [load])

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  function clearFilters() {
    setActionFilter(''); setActorFilter(''); setFromFilter(''); setToFilter(''); setPage(1)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2"><History size={22} />Auditoría</h1>
        <p className="mt-1 text-sm text-text-muted">Registro de acciones administrativas sensibles — crear/editar/desactivar usuarios, cambios de contraseña, configuración de tienda</p>
      </div>

      <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Acción</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text">
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Usuario (email)</label>
          <input type="text" value={actorFilter} onChange={e => setActorFilter(e.target.value)}
            placeholder="nombre@seoulshop.cl"
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Desde</label>
          <input type="date" value={fromFilter} onChange={e => setFromFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Hasta</label>
          <input type="date" value={toFilter} onChange={e => setToFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text" />
        </div>
        <div className="flex gap-2">
          <button type="submit"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-brand)', color: '#fff' }}>
            Filtrar
          </button>
          <button type="button" onClick={clearFilters}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text transition-colors">
            Limpiar
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-subtle border border-error text-sm text-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-error hover:opacity-70">✕</button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Quién</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Acción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Entidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-text-muted">Cargando…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-text-muted">Sin eventos registrados</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id} className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors align-top">
                <td className="px-4 py-3 text-xs text-text-muted font-mono whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-text">{entry.actorEmail ?? '—'}</p>
                  {entry.actorRole && <p className="text-[10px] text-text-muted font-mono capitalize">{entry.actorRole}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/10 text-brand">
                    {actionLabel(entry.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-text-muted font-mono">
                  {entry.entityTable ?? '—'}{entry.entityId ? ` · ${entry.entityId.slice(0, 12)}${entry.entityId.length > 12 ? '…' : ''}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-text-muted max-w-md">
                  {entry.details ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-tight">{JSON.stringify(entry.details, null, 0)}</pre>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
          <span>{total} evento{total !== 1 ? 's' : ''} · página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors">
              <ChevronLeft size={12} />Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors">
              Siguiente<ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
