import Link from 'next/link'
import { Package } from 'lucide-react'
import { getProducts } from '@/lib/api'

export async function ProductsTable() {
  const { products } = await getProducts({ status: 'active' })

  if (products.length === 0) {
    return (
      <div className="bg-elevated rounded-lg border border-[var(--color-border)] p-6 text-center">
        <p className="text-sm text-text-muted font-body">Sin productos activos. <Link href="/products/new" className="text-brand underline">Agrega el primero</Link>.</p>
      </div>
    )
  }

  return (
    <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-surface">
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Producto</th>
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Categoría</th>
            <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Stock</th>
            <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Precio</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const stock = Number(p.stockTotal ?? 0)
            return (
              <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-background shrink-0">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <Package size={18} className="m-auto text-text-muted opacity-40" />
                      }
                    </div>
                    <div>
                      <p className="font-body font-medium text-text">{p.name}</p>
                      {p.nameKo && <p className="text-xs text-text-muted font-body">{p.nameKo}</p>}
                      {p.brand && <p className="text-[10px] text-text-muted font-body">{p.brand}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-body text-text-muted bg-surface px-2 py-0.5 rounded-full">{p.categoryName ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${stock === 0 ? 'text-error' : stock < 5 ? 'text-warning' : 'text-success'}`}>
                    {stock === 0 ? 'Sin stock' : stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-brand">
                  ${Number(p.priceRetail).toLocaleString('es-CL')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
