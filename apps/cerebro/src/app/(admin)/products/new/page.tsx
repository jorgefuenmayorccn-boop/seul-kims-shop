import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ProductForm } from '@/components/cerebro/product-form'
import { getCategories } from '@/lib/api'

export default async function NewProductPage() {
  const { categories } = await getCategories()
  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/products" className="text-text-muted hover:text-text transition-colors"><ChevronLeft size={18} /></Link>
        <div>
          <h1 className="font-headline text-2xl font-bold text-text">Nuevo producto</h1>
          <p className="text-xs text-text-muted font-body mt-0.5">Las imágenes se agregan después de guardar</p>
        </div>
      </div>
      <ProductForm categories={categories} />
    </div>
  )
}
