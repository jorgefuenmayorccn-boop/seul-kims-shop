import { Suspense } from 'react'
import { HeroSlider } from '@seul/ui/shop/hero-slider'
import { CategoryBubble, SEUL_CATEGORIES } from '@seul/ui/shop/category-bubble'
import { ProductCard } from '@seul/ui/shop/product-card'
import { WhatsAppCTA } from '@seul/ui'
import { apiFetch } from '@/lib/api'

async function FeaturedProducts() {
  const data = await apiFetch<{ products: Parameters<typeof ProductCard>[0]['product'][] }>('/api/products?status=active')
  const featured = data.products.slice(0, 8)

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-headline text-2xl font-bold text-text">Lo más pedido</h2>
        <a href="/productos" className="text-sm text-brand hover:underline font-body">Ver todo →</a>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {featured.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">

      {/* Hero */}
      <HeroSlider />

      {/* Categorías */}
      <section>
        <h2 className="font-headline text-xl font-bold text-text mb-5">¿Qué estás buscando?</h2>
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {SEUL_CATEGORIES.map(cat => (
            <CategoryBubble key={cat.slug} name={cat.name} slug={cat.slug} emoji={cat.emoji} />
          ))}
        </div>
      </section>

      {/* Productos destacados */}
      <Suspense fallback={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-[var(--ink-100)] rounded-xl animate-pulse" />
          ))}
        </div>
      }>
        <FeaturedProducts />
      </Suspense>

      {/* Banner SEUL10 */}
      <section className="bg-gradient-to-r from-[var(--color-brand)] to-[#b01d30] rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p className="font-headline text-2xl font-bold">10% en tu primera compra</p>
          <p className="font-body opacity-85 mt-1">Usa el código <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded">SEUL10</span> al finalizar</p>
        </div>
        <a
          href="/productos"
          className="shrink-0 px-6 py-3 bg-white text-brand font-semibold rounded-xl font-body hover:bg-[var(--cream-500)] transition-colors"
        >
          Explorar tienda
        </a>
      </section>

      {/* Banner WhatsApp */}
      <section className="bg-[#25d366]/10 border border-[#25d366]/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="font-headline font-bold text-text text-lg">¿Tienes dudas antes de pedir?</p>
          <p className="text-sm text-text-muted font-body mt-1">Te respondemos en menos de 15 minutos por WhatsApp.</p>
        </div>
        <WhatsAppCTA
          variant="button"
          message="¡Hola! Tengo una consulta sobre su tienda 😊"
        />
      </section>

    </div>
  )
}
