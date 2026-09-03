'use client'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { B2BPricingTable } from '@seul/ui/b2b/b2b-pricing-table'
import { useCartStore, useCartItemCount } from '@/lib/cart-store'

interface B2BProduct {
  id: string; sku: string; slug: string; name: string; brand: string | null
  priceRetail: number; priceB2B: number
  coldChain: 'frozen' | 'refrigerated' | 'ambient'
  isBaesEligible: boolean; weightGrams: number | null; stock: number
}

// Conecta la tabla de precios B2B (antes 100% informativa) con el carrito
// real — el pedido mayorista usa el MISMO useCartStore/checkout que B2C
// (adición post-entrega, pedido explícito del dueño: el portal B2B estaba
// desconectado del resto del sistema, sin forma de comprar). El precio
// guardado en el carrito es priceB2B, no priceRetail — mismo criterio que
// ya usa el toggle B2B del POS (apps/pos/src/lib/pos-store.ts).
export function B2BCatalogList({ products }: { products: B2BProduct[] }) {
  const addItem = useCartStore(s => s.addItem)
  const itemCount = useCartItemCount()

  function handleAdd(p: B2BProduct, qty: number) {
    addItem({
      id: p.id, slug: p.slug, name: p.name, brand: p.brand,
      priceRetail: p.priceB2B, // precio mayorista — el carrito no distingue el campo, guarda el precio efectivo
      coldChain: p.coldChain, isBaesEligible: p.isBaesEligible,
    }, qty)
  }

  return (
    <div className="space-y-4">
      {itemCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 px-4 py-3">
          <p className="text-sm font-medium">
            <ShoppingCart size={14} className="inline -mt-0.5 mr-1.5" />
            {itemCount} {itemCount === 1 ? 'producto' : 'productos'} en tu pedido
          </p>
          <Link href="/checkout" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
            Ir a pagar →
          </Link>
        </div>
      )}
      <B2BPricingTable products={products} onAddToOrder={handleAdd} />
    </div>
  )
}
