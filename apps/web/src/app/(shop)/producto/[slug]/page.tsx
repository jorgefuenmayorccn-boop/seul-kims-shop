import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { BadgeChain, BadgeBAES, BadgeNutrition, WhatsAppCTA, formatCLP } from '@seul/ui'
import { apiServerFetch, CACHE_TAGS } from '@/lib/api-server'
import { Thermometer } from '@seul/icons'
import { productJsonLd, breadcrumbJsonLd } from '@/lib/jsonld'
import { PDPAddButton } from '@/components/shop/pdp-add-button'
import { PDPGallery } from '@/components/shop/pdp-gallery'

interface ProductDetail {
  id:             string
  slug:           string
  name:           string
  nameKo?:        string | null
  brand?:         string | null
  description?:   string | null
  priceRetail:    number
  priceB2B?:      number | null
  coldChain:      'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean
  isWeighable:    boolean
  imageUrl?:      string | null
  images:         Array<{ id: string; url: string }>
  sellos:         string[]
  stockTotal:     number
  nextExpiry?:    string | null
  weightGrams?:   number | null
}

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const p = await apiServerFetch<ProductDetail>(`/api/products/${params.slug}`, {
      tags: [CACHE_TAGS.product(params.slug)],
    })
    const description = p.description ?? `${p.name} — SEUL SHOP CL, Viña del Mar`
    return {
      title: p.name,
      description,
      openGraph: {
        title: p.name,
        description,
        images: p.imageUrl
          ? [{ url: p.imageUrl, width: 800, height: 800, alt: p.name }]
          : [],
        type: 'website',
        locale: 'es_CL',
        siteName: 'SEUL SHOP',
      },
      twitter: {
        card: 'summary_large_image',
        title: p.name,
        description,
        images: p.imageUrl ? [p.imageUrl] : [],
      },
    }
  } catch {
    return { title: 'Producto no encontrado' }
  }
}

const COLD_CHAIN_TEXT: Record<'ambient' | 'refrigerated' | 'frozen', string> = {
  ambient:      '',
  refrigerated: 'Mantener refrigerado entre 0°C y 5°C',
  frozen:       'Mantener congelado a −18°C o menos',
}

export default async function ProductPage({ params }: PageProps) {
  let product: ProductDetail
  try {
    product = await apiServerFetch<ProductDetail>(`/api/products/${params.slug}`, {
      tags: [CACHE_TAGS.product(params.slug)],
    })
  } catch {
    notFound()
  }

  const outOfStock = product.stockTotal <= 0
  const waText = `¡Hola! Me interesa comprar ${product.name}`

  const BASE_URL = 'https://seoulkims.cl'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd({
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          priceRetail: product.priceRetail,
          slug: product.slug,
          stockTotal: product.stockTotal,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([
          { name: 'Inicio', url: BASE_URL },
          { name: 'Productos', url: `${BASE_URL}/productos` },
          { name: product.name, url: `${BASE_URL}/producto/${product.slug}` },
        ])) }}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted font-body mb-6">
        <a href="/" className="hover:text-text transition-colors">Inicio</a>
        <span>/</span>
        <a href="/productos" className="hover:text-text transition-colors">Productos</a>
        <span>/</span>
        <span className="text-text truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">

        {/* Galería interactiva */}
        <div>
          <PDPGallery
            name={product.name}
            images={product.images ?? []}
            coverUrl={product.imageUrl}
          />
        </div>

        {/* Info */}
        <div className="space-y-5">

          {/* Marca + nombre + hangul */}
          <div>
            {product.brand && (
              <p className="text-sm text-text-muted font-body mb-1">{product.brand}</p>
            )}
            <h1 className="font-headline text-2xl md:text-3xl font-bold text-text leading-tight">
              {product.name}
            </h1>
            {product.nameKo && (
              <p className="text-lg text-text-muted font-body mt-1">{product.nameKo}</p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <BadgeChain type={product.coldChain} showLabel />
            {product.isBaesEligible && <BadgeBAES status="eligible" />}
          </div>

          {/* Cadena de frío info */}
          {product.coldChain !== 'ambient' && (
            <div className="flex items-center gap-2 text-xs text-cold-frozen font-body bg-cold-frozen-bg px-3 py-2 rounded-lg">
              <Thermometer size={13} />
              {COLD_CHAIN_TEXT[product.coldChain]}
            </div>
          )}

          {/* Sellos "Alto En" — obligatorio Ley 20.606 */}
          {product.sellos.length > 0 && (
            <div>
              <p className="text-xs text-text-muted font-body mb-2">Información nutricional</p>
              <BadgeNutrition sellos={product.sellos as ('sodio'|'grasas'|'azucares'|'calorias')[]} size="md" />
            </div>
          )}

          {/* Peso */}
          {product.weightGrams && (
            <p className="text-sm text-text-muted font-body">
              Contenido neto: <span className="font-mono">{product.weightGrams >= 1000 ? `${product.weightGrams / 1000} kg` : `${product.weightGrams} g`}</span>
            </p>
          )}

          {/* Precio */}
          <div className="py-4 border-y border-[var(--color-border)]">
            <p className="font-mono text-3xl font-bold text-brand">
              {formatCLP(product.priceRetail)}
              {product.isWeighable && <span className="text-base font-normal text-text-muted">/kg</span>}
            </p>
            {outOfStock ? (
              <p className="text-sm text-text-muted font-body mt-1">Producto agotado — escríbenos para reservar del próximo pedido</p>
            ) : (
              <p className="text-xs text-success font-body mt-1">En stock</p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-3">
            <PDPAddButton
              outOfStock={outOfStock}
              product={{
                id:             product.id,
                slug:           product.slug,
                name:           product.name,
                nameKo:         product.nameKo,
                brand:          product.brand,
                imageUrl:       product.imageUrl,
                priceRetail:    product.priceRetail,
                coldChain:      product.coldChain,
                isBaesEligible: product.isBaesEligible,
              }}
            />
            <WhatsAppCTA
              variant="button"
              message={waText}
              className="w-full justify-center py-3.5 rounded-xl"
            />
          </div>

          {/* Descripción educativa */}
          {product.description && (
            <div className="bg-surface rounded-xl p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide font-body mb-2">Sobre este producto</p>
              <p className="text-sm text-text font-body leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Entrega */}
          <div className="text-sm font-body space-y-1.5">
            <p className="font-semibold text-text">Opciones de entrega</p>
            {product.coldChain !== 'ambient' ? (
              <>
                <p className="text-text-muted">Retiro Metro Merval — gratis</p>
                <p className="text-text-muted">Rappi Express — Viña, Reñaca, Concón</p>
                <p className="text-text-muted">Retiro en tienda</p>
                <p className="text-red-400 text-xs">No disponible para despacho a regiones (cadena de frío)</p>
              </>
            ) : (
              <>
                <p className="text-text-muted">Retiro Metro Merval — gratis</p>
                <p className="text-text-muted">Rappi Express — Viña, Reñaca, Concón</p>
                <p className="text-text-muted">Retiro en tienda</p>
                <p className="text-text-muted">Despacho a regiones — Chilexpress 3-5 días</p>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
