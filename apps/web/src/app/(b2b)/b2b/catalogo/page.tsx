import { Suspense } from 'react'
import { Search } from 'lucide-react'
import { B2BPricingTable } from '@seul/ui/b2b/b2b-pricing-table'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

async function getCatalog(q?: string) {
  const url = new URL(`${API}/api/b2b/catalogo`)
  if (q) url.searchParams.set('q', q)

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) return []
  const data = await res.json() as { products: unknown[] }
  return data.products as Parameters<typeof B2BPricingTable>[0]['products']
}

async function CatalogContent({ q }: { q?: string }) {
  const products = await getCatalog(q)

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        {products.length} productos disponibles — precios netos sin IVA
      </p>
      <B2BPricingTable products={products} />
    </div>
  )
}

export default function CatalogoB2BPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = searchParams.q

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo mayorista</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Precios netos · Actualizado cada 60 s
          </p>
        </div>

        <form method="get" className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar producto…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </form>
      </div>

      {/* Info tiers */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { tier: 'Hoobae 후배', desc: 'Nuevos clientes', credit: '$500.000' },
          { tier: 'Sunbae 선배', desc: 'Clientes recurrentes', credit: '$2.000.000' },
          { tier: 'Hyung 형',   desc: 'Clientes top', credit: '$5.000.000' },
        ].map(t => (
          <div key={t.tier} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="font-semibold text-sm">{t.tier}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t.desc} — cupo {t.credit}</p>
          </div>
        ))}
      </div>

      <Suspense fallback={
        <div className="rounded-lg border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          Cargando catálogo…
        </div>
      }>
        <CatalogContent q={q} />
      </Suspense>

      <div className="mt-8 rounded-lg bg-[var(--color-surface-sunken)] p-4 text-xs text-[var(--color-text-secondary)]">
        Para hacer un pedido mayorista, necesitas una cuenta B2B aprobada.{' '}
        <a href="/b2b/registro" className="underline hover:text-[var(--color-brand)]">Solicitar cuenta</a>
        {' '}o escríbenos al{' '}
        <a href="https://wa.me/56936451991" className="underline hover:text-[var(--color-brand)]">+56 9 3645 1991</a>
      </div>
    </div>
  )
}
