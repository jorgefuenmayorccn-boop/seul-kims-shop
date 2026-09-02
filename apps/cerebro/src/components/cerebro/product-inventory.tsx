'use client'
import { Fragment, useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, AlertTriangle } from 'lucide-react'
import { clientFetch } from '@/lib/client-api'
import { BadgeExpiry } from '@seul/ui'

interface Lot {
  id:           string
  lot:          string | null
  quantity:     number
  expiresAt:    string | null
  costPerUnit:  number | null
  location:     string
  createdAt:    string
  expiryStatus: 'fresh' | 'warning' | 'urgent' | 'expired' | null
}

interface InventoryResponse {
  product: { id: string; name: string; sku: string }
  qtyTotal: number
  lots: Lot[]
}

// Sección "Inventario" dentro de Editar Producto (adición post-entrega,
// 2-sep-2026 — pedido explícito del dueño). Reemplaza al flujo separado
// "Ingresar lote de inventario" (modal con selector de producto, ahora
// deprecado — ver inventory-lot-button.tsx): agrega lotes, ajusta
// cantidades y da de baja, todo en el contexto del producto que ya se está
// editando. Cada ajuste EXIGE un motivo (requisito explícito del dueño,
// "para llevar control") — reflejado en PATCH /api/inventory/:lotId, que
// rechaza con 400 si `reason` viene vacío.
export function ProductInventory({ productId }: { productId: string }) {
  const [data, setData]       = useState<InventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addQty, setAddQty]           = useState('')
  const [addCost, setAddCost]         = useState('')
  const [addLocation, setAddLocation] = useState('')
  const [addExpiresAt, setAddExpiresAt] = useState('')
  const [addLot, setAddLot]           = useState('')
  const [saving, setSaving]           = useState(false)

  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustQty, setAdjustQty]     = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustError, setAdjustError] = useState('')

  function load() {
    setLoading(true)
    clientFetch<InventoryResponse>(`/api/products/${productId}/inventory`)
      .then(setData)
      .catch(() => setError('No se pudo cargar el inventario'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [productId])

  async function handleAddLot(e: React.FormEvent) {
    e.preventDefault()
    if (!addQty) return
    setSaving(true)
    setError('')
    try {
      await clientFetch(`/api/products/${productId}/inventory`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: Number(addQty),
          costPerUnit: addCost ? Number(addCost) : undefined,
          location: addLocation || undefined,
          expiresAt: addExpiresAt || undefined,
          lot: addLot || undefined,
        }),
      })
      setAddQty(''); setAddCost(''); setAddLocation(''); setAddExpiresAt(''); setAddLot('')
      setShowAddForm(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al agregar el lote')
    } finally {
      setSaving(false)
    }
  }

  function startAdjust(lot: Lot) {
    setAdjustingId(adjustingId === lot.id ? null : lot.id)
    setAdjustQty(String(lot.quantity))
    setAdjustReason('')
    setAdjustError('')
  }

  async function handleAdjust(lotId: string) {
    if (!adjustReason.trim()) { setAdjustError('El motivo es obligatorio'); return }
    setSaving(true)
    setAdjustError('')
    try {
      await clientFetch(`/api/inventory/${lotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: Number(adjustQty), reason: adjustReason.trim() }),
      })
      setAdjustingId(null)
      load()
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'Error al ajustar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded text-sm font-body focus:outline-none focus:ring-1 focus:ring-brand"
  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
  const labelCls = "block text-xs font-semibold font-body mb-1"
  const labelStyle = { color: 'var(--color-text-muted)' }

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-text-muted py-4"><Loader2 size={14} className="animate-spin" /> Cargando inventario…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-body text-text">
          Stock total: <span className="font-mono font-bold">{(data?.qtyTotal ?? 0).toLocaleString('es-CL')}</span> unidades
        </p>
        <button type="button" onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-white bg-brand hover:opacity-90 transition-opacity">
          <Plus size={13} /> Agregar lote
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddLot} className="bg-surface rounded-lg border border-[var(--color-border)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Cantidad *</label>
              <input type="number" min="1" step="0.001" value={addQty} onChange={e => setAddQty(e.target.value)}
                required className={inputCls} style={inputStyle} placeholder="12" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Costo unitario (CLP)</label>
              <input type="number" min="0" value={addCost} onChange={e => setAddCost(e.target.value)}
                className={inputCls} style={inputStyle} placeholder="1500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Vencimiento</label>
              <input type="date" value={addExpiresAt} onChange={e => setAddExpiresAt(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Ubicación</label>
              <input type="text" value={addLocation} onChange={e => setAddLocation(e.target.value)}
                className={inputCls} style={inputStyle} placeholder="A-03" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>N° de lote (opcional)</label>
              <input type="text" value={addLot} onChange={e => setAddLot(e.target.value)}
                className={inputCls} style={inputStyle} placeholder="LOTE-001" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !addQty}
              className="px-4 py-2 rounded text-xs font-semibold text-white bg-brand hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Guardando…' : 'Ingresar lote'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded text-xs text-text-muted hover:text-text transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-xs text-error font-body bg-error/10 px-3 py-2 rounded">{error}</p>}

      {(!data || data.lots.length === 0) ? (
        <p className="text-xs text-text-muted font-body py-3">Sin lotes registrados para este producto.</p>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-surface">
                <th className="px-3 py-2 text-left text-text-muted font-body">Lote</th>
                <th className="px-3 py-2 text-right text-text-muted font-body">Cantidad</th>
                <th className="px-3 py-2 text-right text-text-muted font-body">Costo unit.</th>
                <th className="px-3 py-2 text-left text-text-muted font-body">Ubicación</th>
                <th className="px-3 py-2 text-right text-text-muted font-body">Vencimiento</th>
                <th className="px-3 py-2 text-right text-text-muted font-body">Ajustar</th>
              </tr>
            </thead>
            <tbody>
              {data.lots.map(lot => (
                <Fragment key={lot.id}>
                  <tr className={`border-b border-[var(--color-border)] last:border-0 ${lot.expiryStatus === 'expired' || lot.expiryStatus === 'urgent' ? 'bg-error-subtle/20' : ''}`}>
                    <td className="px-3 py-2 font-mono text-text-muted">{lot.lot ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-text">{lot.quantity.toLocaleString('es-CL')}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{lot.costPerUnit != null ? `$${lot.costPerUnit.toLocaleString('es-CL')}` : '—'}</td>
                    <td className="px-3 py-2 text-text-muted capitalize">{lot.location}</td>
                    <td className="px-3 py-2 text-right">
                      {lot.expiresAt ? <BadgeExpiry expiresAt={new Date(lot.expiresAt)} /> : <span className="text-text-muted">Sin fecha</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => startAdjust(lot)} className="p-1 rounded hover:bg-surface text-text-muted hover:text-brand transition-colors" title="Ajustar cantidad">
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                  {adjustingId === lot.id && (
                    <tr className="bg-surface">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-end gap-3 flex-wrap">
                          <div>
                            <label className={labelCls} style={labelStyle}>Nueva cantidad</label>
                            <input type="number" min="0" step="0.001" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                              className={inputCls} style={{ ...inputStyle, width: '110px' }} />
                          </div>
                          <div className="flex-1 min-w-[220px]">
                            <label className={labelCls} style={labelStyle}>Motivo del ajuste *</label>
                            <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                              placeholder="Ej: merma, conteo físico, producto dañado…"
                              className={inputCls} style={inputStyle} />
                          </div>
                          <button type="button" disabled={saving} onClick={() => handleAdjust(lot.id)}
                            className="px-3 py-2 rounded text-xs font-semibold text-white bg-brand hover:opacity-90 transition-opacity disabled:opacity-50">
                            Guardar
                          </button>
                          <button type="button" onClick={() => setAdjustingId(null)}
                            className="px-3 py-2 rounded text-xs text-text-muted hover:text-text transition-colors">
                            Cancelar
                          </button>
                        </div>
                        {adjustError && (
                          <p className="text-[11px] text-error mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> {adjustError}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
