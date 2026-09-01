import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Search, Lock } from 'lucide-react'
import { B2BPricingTable } from '@seul/ui/b2b/b2b-pricing-table'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
// Debe coincidir con CUSTOMER_SESSION_COOKIE_NAME de packages/api/src/server.ts.
const CUSTOMER_COOKIE = 'seul_customer_session'

// El catálogo B2B (precios netos mayoristas) SOLO se muestra a una empresa
// autenticada — nunca a un visitante anónimo ni a un cliente B2C normal
// (requisito explícito de esta sesión). Como esta página es un Server
// Component, reenvía la cookie de sesión a mano en el fetch server-to-server
// — mismo patrón exacto que serverFetch en apps/cerebro/src/lib/api.ts, no
// una excepción nueva. GET /api/b2b/catalogo devuelve 401 (sin sesión) o 403
// (sesión de cliente B2C sin empresa asociada) — ambos casos se resuelven acá
// como "sin acceso", mostrando un estado bloqueado con CTA a login/registro
// en vez de una tabla vacía o un crash.
async function getCatalog(q?: string): Promise<{ status: 'ok'; products: unknown[] } | { status: 'locked' }> {
  const jar = await cookies()
  const token = jar.get(CUSTOMER_COOKIE)?.value
  if (!token) return { status: 'locked' }

  const url = new URL(`${API}/api/b2b/catalogo`)
  if (q) url.searchParams.set('q', q)

  const res = await fetch(url.toString(), {
    headers: { Cookie: `${CUSTOMER_COOKIE}=${token}` },
    cache: 'no-store',
  })
  if (res.status === 401 || res.status === 403) return { status: 'locked' }
  if (!res.ok) return { status: 'ok', products: [] }
  const data = await res.json() as { products: unknown[] }
  return { status: 'ok', products: data.products }
}

function LockedCatalog() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <Lock className="mx-auto size-8 text-[var(--color-text-secondary)]" />
      <h2 className="mt-4 text-lg font-bold">Catálogo exclusivo para empresas mayoristas</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
        Los precios netos sin IVA solo se muestran a cuentas B2B aprobadas. Inicia sesión con tu
        cuenta mayorista o solicita acceso si aún no tienes una.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <a href="/b2b/login" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-raised)]">
          Iniciar sesión
        </a>
        <a href="/b2b/registro" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Solicitar cuenta
        </a>
      </div>
    </div>
  )
}

async function CatalogContent({ q }: { q?: string }) {
  const result = await getCatalog(q)

  if (result.status === 'locked') return <LockedCatalog />

  const products = result.products as Parameters<typeof B2BPricingTable>[0]['products']

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
            Precios netos · Solo cuentas B2B
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
