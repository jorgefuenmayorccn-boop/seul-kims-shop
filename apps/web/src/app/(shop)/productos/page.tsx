import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProductCardEditorialWrapper } from '@/components/shop/product-card-editorial-wrapper'
import { apiServerFetch, CACHE_TAGS } from '@/lib/api-server'
import type { ProductCardEditorialData } from '@seul/ui/shop/product-card-editorial'
import { ProductSearch } from '@/components/shop/product-search'

export const metadata: Metadata = {
  title: 'Productos | SEUL SHOP',
  description: 'Explora nuestra selección de productos coreanos auténticos importados directamente desde Corea del Sur.',
}

async function getProducts(q?: string, category?: string) {
  try {
    const params = new URLSearchParams({ status: 'active', limit: '48' })
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    return await apiServerFetch<{ products: ProductCardEditorialData[]; total: number }>(
      `/api/products?${params}`,
      { tags: [CACHE_TAGS.products, CACHE_TAGS.categories], revalidate: 60 }
    )
  } catch {
    return { products: [], total: 0 }
  }
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string }
}) {
  const { products, total } = await getProducts(searchParams.q, searchParams.category)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-baek-pure)' }}>
      {/* Header editorial */}
      <section
        className="border-b px-8 md:px-16 py-12"
        style={{ borderColor: 'var(--color-border-editorial)' }}
      >
        <p
          className="font-korean font-black text-4xl md:text-6xl leading-none"
          style={{ color: 'var(--color-seoul-red)' }}
        >
          상품
        </p>
        <h1
          className="font-headline font-bold text-2xl md:text-3xl mt-1"
          style={{ color: 'var(--color-heuk)' }}
        >
          PRODUCTOS
        </h1>
        <p
          className="font-body text-sm mt-2"
          style={{ color: 'var(--color-heuk)', opacity: 0.5 }}
        >
          {total > 0 ? `${total} productos importados directamente desde Corea del Sur` : 'Importados directamente desde Corea del Sur'}
        </p>
      </section>

      {/* Buscador */}
      <section className="px-8 md:px-16 py-5" style={{ borderBottom: 'var(--border-editorial)' }}>
        <Suspense fallback={null}>
          <ProductSearch />
        </Suspense>
      </section>

      {/* Grid de productos */}
      <section className="px-6 md:px-16 py-10">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p
              className="font-korean font-black text-5xl"
              style={{ color: 'var(--color-heuk)', opacity: 0.08 }}
            >
              준비 중
            </p>
            <p
              className="font-headline font-bold text-lg mt-4"
              style={{ color: 'var(--color-heuk)' }}
            >
              Catálogo en preparación
            </p>
            <p
              className="font-body text-sm mt-2"
              style={{ color: 'var(--color-heuk)', opacity: 0.5 }}
            >
              Pronto tendremos todos nuestros productos disponibles.
              <br />
              Escríbenos por correo para consultas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product, index) => (
              <ProductCardEditorialWrapper
                key={product.id}
                product={product}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
