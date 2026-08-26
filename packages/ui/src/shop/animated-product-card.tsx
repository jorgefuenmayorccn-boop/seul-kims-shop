'use client'
import { motion } from 'framer-motion'
import { ProductCard, type ProductCardData } from './product-card'

interface AnimatedProductCardProps {
  product: ProductCardData
  index?: number
  onAddToCart?: (id: string) => void
}

export function AnimatedProductCard({ product, index = 0, onAddToCart }: AnimatedProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      <ProductCard product={product} onAddToCart={onAddToCart} />
    </motion.div>
  )
}
