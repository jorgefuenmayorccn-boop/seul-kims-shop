'use client'
import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { clientFetch } from '@/lib/client-api'

interface Product {
  id:   string
  name: string
  sku:  string
}

interface InventoryLotModalProps {
  onClose:   () => void
  onCreated: () => void
}

export function InventoryLotModal({ onClose, onCreated }: InventoryLotModalProps) {
  const [products, setProducts]   = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity]   = useState('')
  const [cost, setCost]           = useState('')
  const [location, setLocation]   = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    clientFetch<{ products: Product[] }>('/api/products?status=all&limit=500')
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !quantity) return
    setLoading(true)
    setError('')

    try {
      await clientFetch('/api/inventory/lot', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          quantity:    Number(quantity),
          costPerUnit: cost ? Number(cost) : undefined,
          location:    location || undefined,
          expiresAt:   expiresAt || undefined,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ingresar lote')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-elevated rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden border border-[var(--color-border)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-headline font-bold text-text text-base">Ingresar lote de inventario</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          <div>
            <label className="block text-xs font-medium text-text-muted font-body mb-1">
              Producto <span className="text-brand">*</span>
            </label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Seleccionar producto…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Cantidad <span className="text-brand">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="0.001"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="12"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Costo unitario (CLP)
              </label>
              <input
                type="number"
                min="0"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="1500"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Ubicación (góndola)
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="A-03"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-body">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-body text-text-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !productId || !quantity}
              className="flex-1 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold font-body hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Ingresar lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
