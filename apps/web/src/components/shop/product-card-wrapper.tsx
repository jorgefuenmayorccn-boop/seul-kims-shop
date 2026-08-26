'use client'
import { ProductCard, type ProductCardData } from '@seul/ui/shop/product-card'
import { useCartStore } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'

interface ProductCardWrapperProps {
  product: ProductCardData
  variant?: 'grid' | 'list'
}

export function ProductCardWrapper({ product, variant }: ProductCardWrapperProps) {
  const addItem = useCartStore(s => s.addItem)
  const openDrawer = useCartUIStore(s => s.openDrawer)

  function handleAddToCart(id: string) {
    if (id !== product.id) return
    addItem({
      id:             product.id,
      slug:           product.slug,
      name:           product.name,
      brand:          product.brand,
      imageUrl:       product.imageUrl,
      priceRetail:    Number(product.priceRetail),
      coldChain:      product.coldChain,
      isBaesEligible: product.isBaesEligible,
    })
    openDrawer()
  }

  return (
    <ProductCard
      product={product}
      variant={variant}
      onAddToCart={handleAddToCart}
    />
  )
}
