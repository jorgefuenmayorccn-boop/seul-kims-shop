'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Thermometer, Snowflake } from 'lucide-react'
import { clientFetch } from '@/lib/client-api'
import { ImageUploader } from './image-uploader'
import type { ProductDetail, Category } from '@/lib/types'

type Sello = 'sodio' | 'grasas' | 'azucares' | 'calorias'
const SELLOS: Sello[] = ['sodio', 'grasas', 'azucares', 'calorias']
const SELLO_LABEL: Record<Sello, string> = {
  sodio: 'Alto en Sodio', grasas: 'Alto en Grasas Saturadas',
  azucares: 'Alto en Azúcares', calorias: 'Alto en Calorías',
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface Props { product?: ProductDetail; categories: Category[] }

export function ProductForm({ product, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState('')
  const [savedId, setSavedId] = useState<string | null>(product?.id ?? null)

  const [form, setForm] = useState({
    sku:            product?.sku           ?? '',
    barcode:        product?.barcode       ?? '',
    name:           product?.name          ?? '',
    nameKo:         product?.nameKo        ?? '',
    slug:           product?.slug          ?? '',
    description:    product?.description   ?? '',
    brand:          product?.brand         ?? '',
    categoryId:     product?.categoryId    ?? '',
    costPrice:      String(product?.costPrice   ?? ''),
    priceRetail:    String(product?.priceRetail ?? ''),
    priceWeb:       String(product?.priceWeb    ?? ''),
    pricePOS:       String(product?.pricePOS    ?? ''),
    priceB2B:       String(product?.priceB2B    ?? ''),
    discountWebPct: String(product?.discountWebPct ?? '0'),
    discountPOSPct: String(product?.discountPOSPct ?? '0'),
    discountB2BPct: String(product?.discountB2BPct ?? '0'),
    weightGrams:    String(product?.weightGrams ?? ''),
    isWeighable:    product?.isWeighable   ?? false,
    isBaesEligible: product?.isBaesEligible ?? false,
    coldChain:      product?.coldChain     ?? 'ambient' as 'ambient' | 'refrigerated' | 'frozen',
    status:         product?.status        ?? 'active'  as 'active' | 'inactive' | 'discontinued',
    sellos:         (product?.sellos ?? []) as Sello[],
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'name' && !product) next.slug = slugify(v as string)
      return next
    })
  }

  function toggleSello(s: Sello) {
    setForm(prev => ({ ...prev, sellos: prev.sellos.includes(s) ? prev.sellos.filter(x => x !== s) : [...prev.sellos, s] }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    startTransition(async () => {
      try {
        const payload = {
          sku: form.sku, barcode: form.barcode || undefined, name: form.name,
          nameKo: form.nameKo || undefined, slug: form.slug,
          description: form.description || undefined, brand: form.brand || undefined,
          categoryId: form.categoryId || undefined,
          costPrice:      form.costPrice      ? Number(form.costPrice)      : undefined,
          priceRetail:    Number(form.priceRetail),
          priceWeb:       form.priceWeb       ? Number(form.priceWeb)       : undefined,
          pricePOS:       form.pricePOS       ? Number(form.pricePOS)       : undefined,
          priceB2B:       form.priceB2B       ? Number(form.priceB2B)       : undefined,
          discountWebPct: Number(form.discountWebPct) || 0,
          discountPOSPct: Number(form.discountPOSPct) || 0,
          discountB2BPct: Number(form.discountB2BPct) || 0,
          weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
          isWeighable: form.isWeighable, isBaesEligible: form.isBaesEligible,
          coldChain: form.coldChain, status: form.status, sellos: form.sellos,
        }
        if (product) {
          await clientFetch<{ ok: boolean }>(`/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(payload) })
          router.refresh()
        } else {
          const res = await clientFetch<{ ok: boolean; id: string }>('/api/products', { method: 'POST', body: JSON.stringify(payload) })
          setSavedId(res.id)
          router.push(`/products/${res.id}/edit?created=1`)
        }
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al guardar') }
    })
  }

  const inputCls = "w-full px-3 py-2 rounded text-sm font-body focus:outline-none focus:ring-1 focus:ring-brand"
  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
  const labelCls = "block text-xs font-semibold font-body mb-1"
  const labelStyle = { color: 'var(--color-text-muted)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-elevated rounded-lg border border-[var(--color-border)] p-5 space-y-4">
        <h2 className="font-headline font-bold text-sm text-text">Datos del producto</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls} style={labelStyle}>SKU *</label>
            <input value={form.sku} onChange={e => set('sku', e.target.value)} required className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={labelStyle}>Código de barras (EAN-13)</label>
            <input value={form.barcode} onChange={e => set('barcode', e.target.value)} className={inputCls} style={inputStyle} placeholder="7891234567890" /></div>
        </div>
        <div><label className={labelCls} style={labelStyle}>Nombre en español *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required className={inputCls} style={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls} style={labelStyle}>Nombre en coreano</label>
            <input value={form.nameKo} onChange={e => set('nameKo', e.target.value)} className={inputCls} style={inputStyle} placeholder="라면" /></div>
          <div><label className={labelCls} style={labelStyle}>Marca</label>
            <input value={form.brand} onChange={e => set('brand', e.target.value)} className={inputCls} style={inputStyle} placeholder="Nongshim, Ottogi…" /></div>
        </div>
        <div><label className={labelCls} style={labelStyle}>Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inputCls} style={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls} style={labelStyle}>Slug (URL)</label>
            <input value={form.slug} onChange={e => set('slug', e.target.value)} required className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={labelStyle}>Categoría</label>
            <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select></div>
        </div>
      </section>

      <section className="bg-elevated rounded-lg border border-[var(--color-border)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-sm text-text">Precios (CLP)</h2>
          {form.costPrice && form.priceRetail && Number(form.priceRetail) > 0 && (
            <span className="text-xs font-mono font-semibold px-2 py-1 rounded"
              style={{ background: 'var(--color-brand)', color: '#fff', opacity: 0.85 }}>
              Margen {Math.round((Number(form.priceRetail) - Number(form.costPrice)) / Number(form.priceRetail) * 100)}%
            </span>
          )}
        </div>

        {/* Costo + Retail */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>Costo compra</label>
            <input type="number" min="0" value={form.costPrice} onChange={e => set('costPrice', e.target.value)}
              className={inputCls} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Precio retail * <span className="text-[10px] font-normal">(fallback todos los canales)</span></label>
            <input type="number" min="1" value={form.priceRetail} onChange={e => set('priceRetail', e.target.value)}
              required className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Peso (gramos)</label>
            <input type="number" min="1" value={form.weightGrams} onChange={e => set('weightGrams', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
        </div>

        {/* Precios por canal */}
        <div className="grid grid-cols-3 gap-4 pt-1">
          <div>
            <label className={labelCls} style={{ ...labelStyle }}>
              Precio web <span className="text-[10px] font-normal">(override retail)</span>
            </label>
            <input type="number" min="1" value={form.priceWeb} onChange={e => set('priceWeb', e.target.value)}
              className={inputCls} style={inputStyle} placeholder={form.priceRetail || '—'} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Precio POS <span className="text-[10px] font-normal">(override retail)</span>
            </label>
            <input type="number" min="1" value={form.pricePOS} onChange={e => set('pricePOS', e.target.value)}
              className={inputCls} style={inputStyle} placeholder={form.priceRetail || '—'} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Precio B2B <span className="text-[10px] font-normal">(neto mayorista)</span>
            </label>
            <input type="number" min="1" value={form.priceB2B} onChange={e => set('priceB2B', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
        </div>

        {/* Descuentos por canal */}
        <div className="grid grid-cols-3 gap-4 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <label className={labelCls} style={labelStyle}>Dscto. web %</label>
            <input type="number" min="0" max="100" value={form.discountWebPct} onChange={e => set('discountWebPct', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Dscto. POS %</label>
            <input type="number" min="0" max="100" value={form.discountPOSPct} onChange={e => set('discountPOSPct', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Dscto. B2B %</label>
            <input type="number" min="0" max="100" value={form.discountB2BPct} onChange={e => set('discountB2BPct', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </section>

      <section className="bg-elevated rounded-lg border border-[var(--color-border)] p-5 space-y-4">
        <h2 className="font-headline font-bold text-sm text-text">Atributos</h2>
        <div>
          <label className={labelCls} style={labelStyle}>Cadena de frío</label>
          <div className="flex gap-2 mt-1">
            {(['ambient', 'refrigerated', 'frozen'] as const).map(v => (
              <button key={v} type="button" onClick={() => set('coldChain', v)}
                className={`px-3 py-1.5 rounded text-xs font-body border transition-colors ${form.coldChain === v ? 'bg-brand text-white border-brand' : 'border-[var(--color-border)] text-text-muted hover:bg-surface'}`}>
                {v === 'ambient'      ? <><Thermometer size={12} className="inline mr-1" />Ambiente</>
                 : v === 'refrigerated' ? <><Snowflake size={12} className="inline mr-1 text-blue-400" />Refrigerado</>
                 :                        <><Snowflake size={12} className="inline mr-1 text-blue-600" />Congelado</>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isBaesEligible} onChange={e => set('isBaesEligible', e.target.checked)} className="w-4 h-4 accent-brand" />
            <span className="text-sm font-body text-text">Elegible BAES (JUNAEB)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isWeighable} onChange={e => set('isWeighable', e.target.checked)} className="w-4 h-4 accent-brand" />
            <span className="text-sm font-body text-text">Se vende por peso (kg)</span>
          </label>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Sellos "Alto En" — Ley 20.606</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {SELLOS.map(s => (
              <button key={s} type="button" onClick={() => toggleSello(s)}
                className={`px-3 py-1.5 rounded text-xs font-body border transition-colors ${form.sellos.includes(s) ? 'bg-error/10 text-error border-error' : 'border-[var(--color-border)] text-text-muted hover:bg-surface'}`}>
                {SELLO_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        {product && (
          <div>
            <label className={labelCls} style={labelStyle}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value as typeof form.status)} className={inputCls} style={{ ...inputStyle, width: '200px' }}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="discontinued">Descontinuado</option>
            </select>
          </div>
        )}
      </section>

      {savedId ? (
        <section className="bg-elevated rounded-lg border border-[var(--color-border)] p-5 space-y-3">
          <h2 className="font-headline font-bold text-sm text-text">Imágenes</h2>
          <ImageUploader productId={savedId} initial={product?.images ?? []} />
        </section>
      ) : (
        <div className="bg-surface rounded-lg border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-text-muted font-body">Las imágenes se pueden agregar después de guardar el producto por primera vez.</p>
        </div>
      )}

      {error && <p className="text-xs text-error font-body bg-error/10 px-3 py-2 rounded">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded font-headline font-bold text-sm text-white bg-brand hover:opacity-90 transition-opacity disabled:opacity-50">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isPending ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button type="button" onClick={() => router.push('/products')} className="text-sm text-text-muted font-body hover:text-text transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
