import { Suspense } from 'react'
import { CategoryNav } from '@seul/ui/shop/category-nav'
import { ShopFooter } from '@seul/ui/shop/shop-footer'
import { WhatsAppCTA } from '@seul/ui'
import { apiServerFetch, CACHE_TAGS } from '@/lib/api-server'
import { ProductCardEditorialWrapper } from '@/components/shop/product-card-editorial-wrapper'
import type { ProductCardEditorialData } from '@seul/ui/shop/product-card-editorial'
import { localBusinessJsonLd } from '@/lib/jsonld'
import { LocaleHero } from '@/components/shop/locale-hero'

async function FeaturedProducts() {
  try {
    const data = await apiServerFetch<{ products: ProductCardEditorialData[] }>(
      '/api/products?status=active',
      { tags: [CACHE_TAGS.products], revalidate: 60 }
    )
    const featured = data.products.slice(0, 8)

    if (featured.length === 0) {
      return (
        <section className="py-16 text-center" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
          <p className="font-korean text-2xl mb-2">준비 중</p>
          <p className="font-body text-sm">Catálogo en preparación — vuelve pronto</p>
        </section>
      )
    }

    return (
      <section className="px-8 md:px-16 py-14">
        {/* Header editorial */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <span
              className="font-korean text-xs font-medium block mb-1"
              style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em' }}
            >
              인기 상품
            </span>
            <h2
              className="font-headline font-bold leading-none"
              style={{ fontSize: 'clamp(24px, 4vw, 40px)', color: 'var(--color-heuk)' }}
            >
              Lo más pedido
            </h2>
          </div>
          <a
            href="/productos"
            className="font-body text-xs tracking-widest hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.14em' }}
          >
            VER TODO →
          </a>
        </div>

        {/* Grid editorial */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {featured.map((p, i) => (
            <ProductCardEditorialWrapper
              key={p.id}
              index={i}
              product={{
                ...p,
                priceRetail: Number(p.priceRetail),
                stockTotal:  Number((p as any).stockTotal ?? 0),
              }}
            />
          ))}
        </div>
      </section>
    )
  } catch {
    return (
      <section className="px-8 py-16 text-center">
        <p
          className="font-headline font-bold text-lg"
          style={{ color: 'var(--color-heuk)' }}
        >
          Catálogo temporalmente offline
        </p>
        <p className="font-body text-sm mt-2" style={{ color: 'var(--color-heuk)', opacity: 0.5 }}>
          Escríbenos al{' '}
          <a href="https://wa.me/56936451991" className="underline" style={{ color: '#25d366' }}>
            WhatsApp
          </a>{' '}
          y te ayudamos de inmediato
        </p>
      </section>
    )
  }
}

export default function HomePage() {
  return (
    <div className="flex flex-col" style={{ background: 'var(--color-baek-pure, var(--baek-50))' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
      />

      {/* Hero editorial fullbleed — locale-aware */}
      <LocaleHero />

      {/* Navegación de categorías Musinsa-style */}
      <CategoryNav />

      {/* Productos destacados */}
      <Suspense fallback={
        <div className="px-8 md:px-16 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="animate-pulse" style={{ aspectRatio: '4/5', background: 'var(--color-celadon-light)' }} />
                <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: 'var(--color-celadon-light)' }} />
                <div className="h-3 w-1/2 animate-pulse rounded" style={{ background: 'var(--color-celadon-light)' }} />
              </div>
            ))}
          </div>
        </div>
      }>
        <FeaturedProducts />
      </Suspense>

      {/* Línea divisora */}
      <div className="mx-8 md:mx-16" style={{ height: 1, background: 'var(--border-editorial)' }} />

      {/* Banner descuento primera compra — editorial */}
      <section
        className="px-8 md:px-16 py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
        style={{ background: 'var(--color-heuk)', color: 'var(--color-baek)' }}
      >
        <div>
          <span
            className="font-korean text-xs block mb-2"
            style={{ color: 'var(--color-celadon)', letterSpacing: '0.18em' }}
          >
            첫 구매 할인
          </span>
          <p
            className="font-headline font-bold leading-tight"
            style={{ fontSize: 'clamp(22px, 3.5vw, 38px)', color: 'var(--color-baek)' }}
          >
            10% en tu primera compra
          </p>
          <p className="font-body mt-2 text-sm" style={{ color: 'var(--color-baek)', opacity: 0.6 }}>
            Usa el código{' '}
            <span
              className="font-mono font-bold px-2 py-0.5"
              style={{ background: 'var(--color-seoul-red)', color: 'var(--color-baek)' }}
            >
              SEUL10
            </span>
            {' '}al finalizar tu pedido
          </p>
        </div>
        <a
          href="/productos"
          className="shrink-0 px-8 py-4 font-body font-semibold text-sm tracking-widest transition-colors"
          style={{
            background: 'var(--color-baek)',
            color: 'var(--color-heuk)',
            letterSpacing: '0.14em',
          }}
        >
          EXPLORAR TIENDA →
        </a>
      </section>

      {/* Línea divisora */}
      <div style={{ height: 1, background: 'var(--border-editorial)' }} />

      {/* Propuestas de valor — estilo tabla editorial */}
      <section className="px-8 md:px-16 py-14">
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: 'var(--border-editorial)', border: 'var(--border-editorial)' }}>
          {[
            { ko: '정품', title: 'Importación auténtica', desc: 'Productos directamente desde Corea del Sur, sin intermediarios ni adulteraciones.' },
            { ko: '지하철', title: 'Retiro gratis en Metro', desc: 'Recoge tu pedido en estación Merval Miramar sin costo adicional.' },
            { ko: '빠른배달', title: 'Delivery con Rappi', desc: 'Recibe en menos de 60 minutos en Viña, Reñaca y Concón.' },
          ].map((item, i) => (
            <div key={item.ko} className="p-8" style={{ borderColor: 'var(--border-editorial)' }}>
              <span
                className="font-korean font-black text-3xl block mb-4"
                style={{ color: 'var(--color-celadon)' }}
              >
                {item.ko}
              </span>
              <h3
                className="font-body font-semibold text-base mb-2"
                style={{ color: 'var(--color-heuk)' }}
              >
                {item.title}
              </h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Banner WhatsApp — minimal */}
      <section
        className="px-8 md:px-16 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{ borderTop: 'var(--border-editorial)', borderBottom: 'var(--border-editorial)' }}
      >
        <div>
          <span className="font-korean text-xs block mb-1" style={{ color: 'var(--color-celadon)', letterSpacing: '0.18em' }}>카카오 상담</span>
          <p className="font-headline font-bold text-xl" style={{ color: 'var(--color-heuk)' }}>
            ¿Tienes dudas antes de pedir?
          </p>
          <p className="font-body text-sm mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.5 }}>
            Te respondemos en menos de 15 minutos
          </p>
        </div>
        <WhatsAppCTA
          variant="button"
          message="¡Hola! Tengo una consulta sobre SEUL SHOP"
        />
      </section>

      {/* Footer */}
      <ShopFooter />

    </div>
  )
}
