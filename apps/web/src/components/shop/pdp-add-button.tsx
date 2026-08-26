'use client'
import { ShoppingCart } from '@seul/icons'
import { useCartStore } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'
import type { CartItem } from '@/lib/cart-store'

interface PDPAddButtonProps {
  product: Omit<CartItem, 'quantity'>
  outOfStock: boolean
}

export function PDPAddButton({ product, outOfStock }: PDPAddButtonProps) {
  const { addItem } = useCartStore()
  const { openDrawer } = useCartUIStore()

  function handleAdd() {
    if (outOfStock) return
    addItem(product)
    openDrawer()
  }

  return (
    <button
      onClick={handleAdd}
      disabled={outOfStock}
      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-brand text-white font-headline font-bold text-base hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <ShoppingCart size={18} />
      {outOfStock ? 'Sin stock' : 'Agregar al pedido'}
    </button>
  )
}
