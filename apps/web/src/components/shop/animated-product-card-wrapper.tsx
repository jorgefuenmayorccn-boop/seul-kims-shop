'use client'
import { motion } from 'framer-motion'
import { ProductCard, type ProductCardData } from '@seul/ui/shop/product-card'
import { useCartStore } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'

interface Props {
  product: ProductCardData
  index?: number
}

export function AnimatedProductCardWrapper({ product, index = 0 }: Props) {
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
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.065, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      <ProductCard
        product={product}
        onAddToCart={handleAddToCart}
      />
    </motion.div>
  )
}
