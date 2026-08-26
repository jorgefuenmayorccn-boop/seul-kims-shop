'use client'
import { ShoppingBag } from '@seul/icons'
import { useCartItemCount } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'

export function CartButton() {
  const count = useCartItemCount()
  const toggle = useCartUIStore(s => s.toggleDrawer)

  return (
    <button
      onClick={toggle}
      className="relative flex items-center gap-2 group"
      aria-label={`장바구니 — Carrito (${count} items)`}
    >
      <div className="relative">
        <ShoppingBag
          size={20}
          color="var(--color-heuk)"
          className="transition-colors group-hover:opacity-70"
        />
        {count > 0 && (
          <span
            className="absolute -top-2 -right-2 min-w-[17px] h-[17px] flex items-center justify-center text-[9px] font-mono font-black px-1"
            style={{ background: 'var(--color-seoul-red)', color: 'var(--color-baek)' }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
      <span
        className="hidden sm:block font-korean text-[11px] transition-opacity group-hover:opacity-60"
        style={{ color: 'var(--color-heuk)' }}
      >
        장바구니
      </span>
    </button>
  )
}
