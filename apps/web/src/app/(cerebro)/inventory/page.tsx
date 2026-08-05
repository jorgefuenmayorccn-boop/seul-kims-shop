import { Suspense } from 'react'
import { getInventory } from '@/lib/api'
import { InventoryRow } from '@/components/cerebro/inventory-row'
import { EmptyState, AlertBanner } from '@seul/ui'
import { SlidersHorizontal, Plus } from 'lucide-react'

interface PageProps {
  searchParams: { category?: string; expiry?: string; cold_chain?: string; baes?: string }
}

async function InventoryTable({ searchParams }: PageProps) {
  const data = await getInventory(
    Object.fromEntries(Object.entries(searchParams).filter(([, v]) => Boolean(v)))
  )

  const hasExpired = data.items.some(i => i.expiryStatus === 'expired')

  return (
    <div className="space-y-4">
      {hasExpired && (
        <AlertBanner
          severity="critical"
          title="Hay productos VENCIDOS con stock positivo"
          description="Revisar y retirar de góndola inmediatamente para cumplir normativa."
        />
      )}

      <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-hidden">
        {data.items.length === 0 ? (
          <EmptyState variant="no-stock" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-surface">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted font-body">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted font-body">Atributos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted font-body">Lote</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted font-body">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => (
                <InventoryRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-muted font-mono px-1">
        {data.total} lote{data.total !== 1 ? 's' : ''} · ordenados por vencimiento
      </p>
    </div>
  )
}

export default function InventoryPage({ searchParams }: PageProps) {
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">Inventario</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">Lotes · vencimientos · cadena de frío · BAES</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 text-sm text-text-muted border border-[var(--color-border)] px-3 py-1.5 rounded-md hover:bg-surface transition-colors">
            <SlidersHorizontal size={14} />
            Filtros
          </button>
          <button className="flex items-center gap-2 text-sm text-white bg-brand px-3 py-1.5 rounded-md hover:bg-brand-hover transition-colors">
            <Plus size={14} />
            Ingresar lote
          </button>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Todos', params: {} },
          { label: '⚠️ Urgentes', params: { expiry: 'urgent' } },
          { label: '🟡 Por vencer', params: { expiry: 'warning' } },
          { label: '⛔ Vencidos', params: { expiry: 'expired' } },
          { label: '❄️ Cadena frío', params: { cold_chain: 'frozen' } },
          { label: '🅱 BAES', params: { baes: 'true' } },
        ].map(filter => (
          <a
            key={filter.label}
            href={`/cerebro/inventory?${new URLSearchParams(filter.params).toString()}`}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-text-muted hover:bg-surface hover:text-text transition-colors font-body"
          >
            {filter.label}
          </a>
        ))}
      </div>

      {/* Tabla */}
      <Suspense fallback={
        <div className="bg-elevated rounded-lg border border-[var(--color-border)] p-8 text-center text-text-muted text-sm">
          Cargando inventario…
        </div>
      }>
        <InventoryTable searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
