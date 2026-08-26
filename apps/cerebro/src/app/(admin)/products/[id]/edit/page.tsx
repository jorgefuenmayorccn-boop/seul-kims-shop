import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/cerebro/product-form'
import { getProductById, getCategories } from '@/lib/api'

interface PageProps { params: { id: string }; searchParams: { created?: string } }

export default async function EditProductPage({ params, searchParams }: PageProps) {
  const [product, { categories }] = await Promise.all([getProductById(params.id), getCategories()])
  if (!product) notFound()

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/products" className="text-text-muted hover:text-text transition-colors"><ChevronLeft size={18} /></Link>
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">{product.name}</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">SKU {product.sku} · {product.slug}</p>
        </div>
      </div>
      {searchParams.created === '1' && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3">
          <p className="text-sm font-body text-success">Producto creado. Ahora puedes agregar imágenes.</p>
        </div>
      )}
      <ProductForm product={product} categories={categories} />
    </div>
  )
}
