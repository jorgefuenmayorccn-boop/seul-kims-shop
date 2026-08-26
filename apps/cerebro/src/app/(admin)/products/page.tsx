import Link from 'next/link'
import { Plus, Edit2, Snowflake, Thermometer, Package, CheckCircle, PauseCircle, Archive } from 'lucide-react'
import { getProducts } from '@/lib/api'

interface PageProps { searchParams: { q?: string; status?: string } }

const STATUS_LABEL: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', discontinued: 'Descontinuado' }
const STATUS_COLOR: Record<string, string>  = { active: 'text-success', inactive: 'text-warning', discontinued: 'text-text-disabled' }
const COLD_ICON: Record<string, React.ReactNode> = {
  ambient:      null,
  refrigerated: <Thermometer size={11} className="inline text-blue-400" />,
  frozen:       <Snowflake   size={11} className="inline text-blue-600" />,
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params: Record<string, string> = { status: searchParams.status ?? 'all' }
  if (searchParams.q) params.q = searchParams.q

  const { products, total } = await getProducts(params)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">Productos</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">Catálogo · precios · imágenes · atributos</p>
        </div>
        <Link href="/products/new" className="flex items-center gap-2 text-sm text-white bg-brand px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
          <Plus size={14} /> Agregar producto
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {[
          { label: 'Todos',          status: 'all',          icon: null },
          { label: 'Activos',        status: 'active',       icon: <CheckCircle size={11} className="inline" /> },
          { label: 'Inactivos',      status: 'inactive',     icon: <PauseCircle size={11} className="inline" /> },
          { label: 'Descontinuados', status: 'discontinued', icon: <Archive      size={11} className="inline" /> },
        ].map(f => {
          const active = (searchParams.status ?? 'all') === f.status
          return (
            <Link key={f.status} href={`/products?status=${f.status}`}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-body ${active ? 'bg-brand text-white border-brand' : 'border-[var(--color-border)] text-text-muted hover:bg-surface hover:text-text'}`}>
              {f.icon}{f.label}
            </Link>
          )
        })}
        <form method="GET" action="/products" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={searchParams.status ?? 'all'} />
          <input name="q" defaultValue={searchParams.q} placeholder="Buscar producto…"
            className="px-3 py-1.5 text-xs rounded border font-body focus:outline-none focus:ring-1 focus:ring-brand"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)', width: 200 }} />
          <button type="submit" className="px-3 py-1.5 text-xs rounded bg-surface border border-[var(--color-border)] text-text-muted hover:text-text transition-colors font-body">Buscar</button>
        </form>
      </div>

      <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-text-muted font-body">No hay productos. <Link href="/products/new" className="text-brand underline">Agrega el primero</Link>.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-surface">
                <th className="px-4 py-3 w-12" />
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted font-body">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted font-body">SKU / Barcode</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">Retail</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">B2B</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted font-body">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted font-body">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const stock = Number(p.stockTotal ?? 0)
                return (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-background">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package size={18} className="m-auto text-text-muted opacity-40" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-body font-medium text-text">{p.name}</p>
                      {p.nameKo && <p className="text-xs text-text-muted font-korean">{p.nameKo}</p>}
                      <div className="flex gap-1 mt-0.5">
                        {p.brand && <span className="text-[10px] text-text-muted font-body">{p.brand}</span>}
                        {p.coldChain !== 'ambient' && <span className="text-[10px]">{COLD_ICON[p.coldChain]}</span>}
                        {p.isBaesEligible && <span className="text-[10px] text-brand font-bold">BAES</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-text">{p.sku}</p>
                      {p.barcode && <p className="text-[10px] text-text-muted font-mono">{p.barcode}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-brand">${Number(p.priceRetail).toLocaleString('es-CL')}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">{p.priceB2B ? `$${Number(p.priceB2B).toLocaleString('es-CL')}` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm font-bold ${stock === 0 ? 'text-error' : stock < 5 ? 'text-warning' : 'text-success'}`}>
                        {stock === 0 ? 'Sin stock' : stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-body ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/products/${p.id}/edit`} className="p-1.5 rounded hover:bg-surface text-text-muted hover:text-brand transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-text-muted font-mono px-1">{total} producto{total !== 1 ? 's' : ''}</p>
    </div>
  )
}
