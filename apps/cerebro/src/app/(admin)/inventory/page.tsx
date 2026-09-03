import { Suspense } from 'react'
import { AlertTriangle, Clock, XOctagon } from 'lucide-react'
import { getInventory } from '@/lib/api'
import { InventoryRow } from '@/components/cerebro/inventory-row'
import { AlertBanner } from '@seul/ui'
import { InventoryLotButton } from '@/components/cerebro/inventory-lot-button'

interface PageProps { searchParams: { category?: string; expiry?: string; cold_chain?: string; baes?: string } }

async function InventoryTable({ searchParams }: PageProps) {
  const data = await getInventory(Object.fromEntries(Object.entries(searchParams).filter(([, v]) => Boolean(v))))
  const hasExpired = data.items.some(i => i.expiryStatus === 'expired')

  return (
    <div className="space-y-4">
      {hasExpired && <AlertBanner severity="critical" title="Hay productos VENCIDOS con stock positivo" description="Revisar y retirar de góndola inmediatamente para cumplir normativa." />}
      <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-x-auto">
        {data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-muted font-body">Sin lotes en inventario.</div>
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
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted font-body">Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => <InventoryRow key={item.id} item={item} />)}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-text-muted font-mono px-1">{data.total} lote{data.total !== 1 ? 's' : ''} · ordenados por vencimiento</p>
    </div>
  )
}

export default function InventoryPage({ searchParams }: PageProps) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">Inventario</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">Lotes · vencimientos · cadena de frío · BAES</p>
        </div>
        <InventoryLotButton />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Todos',       params: {},                          icon: null },
          { label: 'Urgentes',    params: { expiry: 'urgent' },        icon: <AlertTriangle size={11} className="inline text-error" /> },
          { label: 'Por vencer',  params: { expiry: 'warning' },       icon: <Clock         size={11} className="inline text-warning" /> },
          { label: 'Vencidos',    params: { expiry: 'expired' },       icon: <XOctagon      size={11} className="inline text-error" /> },
          { label: 'Cadena frío', params: { cold_chain: 'frozen' },    icon: null },
          { label: 'BAES',        params: { baes: 'true' },            icon: null },
        ].map(filter => (
          <a key={filter.label} href={`/inventory?${new URLSearchParams(filter.params as Record<string, string>).toString()}`}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-text-muted hover:bg-surface hover:text-text transition-colors font-body">
            {filter.icon}{filter.label}
          </a>
        ))}
      </div>

      <Suspense fallback={<div className="bg-elevated rounded-lg border border-[var(--color-border)] p-8 text-center text-text-muted text-sm">Cargando inventario…</div>}>
        <InventoryTable searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
