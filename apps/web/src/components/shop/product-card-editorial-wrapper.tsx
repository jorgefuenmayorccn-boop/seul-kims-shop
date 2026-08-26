'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@seul/icons'
import { ProductCardEditorial, type ProductCardEditorialData } from '@seul/ui/shop/product-card-editorial'
import { useCartStore } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'

interface Props {
  product: ProductCardEditorialData
  index?:  number
}

export function ProductCardEditorialWrapper({ product, index = 0 }: Props) {
  const addItem  = useCartStore(s => s.addItem)
  const openDrawer = useCartUIStore(s => s.openDrawer)
  const [flash, setFlash] = useState(false)

  function handleAdd(p: ProductCardEditorialData) {
    addItem({
      id:             p.id,
      slug:           p.slug,
      name:           p.name,
      nameKo:         p.nameKo ?? undefined,
      brand:          p.brand ?? undefined,
      imageUrl:       p.imageUrl ?? undefined,
      priceRetail:    Number(p.priceRetail),
      coldChain:      p.coldChain,
      isBaesEligible: p.isBaesEligible,
    })
    setFlash(true)
    setTimeout(() => {
      setFlash(false)
      openDrawer()
    }, 600)
  }

  return (
    <div className="relative">
      <ProductCardEditorial product={product} index={index} onAdd={handleAdd} />

      {/* Flash 담김 — confirmación visual */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -8 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span
              className="font-korean font-black text-2xl flex items-center gap-1"
              style={{ color: 'var(--color-celadon)', textShadow: '0 2px 12px rgba(124,163,142,0.5)' }}
            >
              담김 <Check size={22} strokeWidth={3} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
