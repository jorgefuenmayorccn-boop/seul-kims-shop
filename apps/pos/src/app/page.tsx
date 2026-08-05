'use client'
import { useState, useEffect } from 'react'
import { Search, ShoppingCart, RotateCcw } from 'lucide-react'
import { ProductTile } from '@seul/ui/pos/product-tile'
import { CartLine } from '@seul/ui/pos/cart-line'
import { ColdChainAlert } from '@seul/ui/pos/cold-chain-alert'
import { EmptyState, StatusPill, cn, formatCLP } from '@seul/ui'
import { CheckoutModal } from '@/components/pos/checkout-modal'
import { usePOSStore } from '@/lib/pos-store'

// Categorías POS — orden fijo, emojis para reconocimiento rápido
const CATEGORIES = [
  { id: null,            label: '🏪 Todo' },
  { id: 'ramen',         label: '🍜 Ramen' },
  { id: 'kimchi',        label: '🥬 Kimchi' },
  { id: 'snacks',        label: '🍿 Snacks' },
  { id: 'bebidas',       label: '🥤 Bebidas' },
  { id: 'salsas',        label: '🌶 Salsas' },
  { id: 'congelados',    label: '❄️ Congelados' },
  { id: 'k-beauty',      label: '✨ K-Beauty' },
  { id: 'otros',         label: '📦 Otros' },
] as const

type Product = {
  id: string; name: string; sku: string; brand: string | null
  priceRetail: number; coldChain: 'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean; isWeighable: boolean
  stockTotal: number; imageUrl: string | null; categoryId: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function POSPage() {
  const store = usePOSStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (query)    params.set('q', query)
    if (category) params.set('category', category)

    setLoading(true)
    fetch(`${API}/api/products?${params}`)
      .then(r => r.json() as Promise<{ products: Product[] }>)
      .then(d => setProducts(d.products))
      .finally(() => setLoading(false))
  }, [query, category])

  async function handleConfirm(method: string) {
    await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'pos',
        deliveryMode: 'pickup',
        items: store.cart.map(i => ({
          productId: i.id,
          quantity:  i.quantity,
          unitPrice: i.unitPrice,
          isBaes:    store.baesSession ? i.isBaes : false,
        })),
      }),
    })
    store.clearCart()
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar categorías ── */}
      <aside className="w-[var(--pos-category-width)] shrink-0 bg-elevated border-r border-[var(--color-border)] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <p className="font-headline font-bold text-brand text-base leading-tight">SEUL KING</p>
          <p className="font-mono text-[10px] text-text-muted">POS Caja</p>
        </div>

        {/* Nav categorías */}
        <nav className="flex-1 overflow-y-auto py-2">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={String(id)}
              onClick={() => setCategory(id)}
              className={cn(
                'w-full text-left px-4 min-h-[44px] text-sm font-body transition-colors',
                category === id
                  ? 'bg-brand/8 text-brand font-semibold border-r-2 border-brand'
                  : 'text-text-muted hover:text-text hover:bg-surface',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Info turno */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-text-muted font-mono">
          {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </aside>

      {/* ── Grilla productos ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Buscador */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-elevated">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar producto o SKU…"
              className="w-full pl-9 pr-4 py-2.5 bg-surface rounded-md border border-[var(--color-border)] text-sm font-body focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-28 bg-[var(--ink-100)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState variant="no-results" />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {products.map(p => (
                <ProductTile
                  key={p.id}
                  product={p}
                  onAdd={(id) => {
                    const product = products.find(p => p.id === id)!
                    store.addProduct(product)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Panel carrito ── */}
      <aside className="w-[30%] min-w-[260px] max-w-[360px] shrink-0 flex flex-col bg-elevated border-l border-[var(--color-border)]">

        {/* Header carrito */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-text-muted" />
            <span className="text-sm font-semibold font-body text-text">
              Carrito
              {store.itemCount > 0 && (
                <span className="ml-1.5 text-xs bg-brand text-white px-1.5 py-0.5 rounded-full font-mono">
                  {store.itemCount}
                </span>
              )}
            </span>
          </div>
          {store.cart.length > 0 && (
            <button
              onClick={store.clearCart}
              className="text-xs text-text-muted hover:text-error transition-colors flex items-center gap-1"
              aria-label="Vaciar carrito"
            >
              <RotateCcw size={12} />
              Vaciar
            </button>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {store.cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 p-6">
              <ShoppingCart size={32} className="opacity-30" />
              <p className="text-sm font-body">Agrega productos del catálogo</p>
            </div>
          ) : (
            <>
              {store.cart.map(item => (
                <CartLine
                  key={item.id}
                  item={item}
                  baesActive={!!store.baesSession}
                  onRemove={store.removeProduct}
                  onQuantityChange={store.updateQuantity}
                />
              ))}
            </>
          )}
        </div>

        {/* Alertas cadena de frío */}
        {store.hasColdChain && (
          <div className="px-4 pb-2">
            <ColdChainAlert hasFrozen={store.hasFrozen} hasRefrigerated={store.hasRefrigerated} />
          </div>
        )}

        {/* Totales + botón cobrar */}
        {store.cart.length > 0 && (
          <div className="border-t border-[var(--color-border)] p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm font-body">
                <span className="text-text-muted">Subtotal</span>
                <span className="font-mono text-text">{formatCLP(store.subtotal)}</span>
              </div>
              {store.baesAmount > 0 && (
                <div className="flex justify-between text-sm font-body">
                  <span className="text-[var(--color-baes-applied-text)] font-semibold">BAES (−)</span>
                  <span className="font-mono text-[var(--color-baes-applied-text)] font-semibold">
                    {formatCLP(store.baesAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-[var(--color-border)]">
                <span className="font-headline font-bold text-text">Total</span>
                <span className="font-mono font-bold text-xl text-brand">{formatCLP(store.total)}</span>
              </div>
            </div>

            <button
              onClick={() => store.setCheckoutOpen(true)}
              className="w-full min-h-[var(--pos-hit-area-min)] bg-brand text-white rounded-lg font-headline font-bold text-base hover:bg-brand-hover active:scale-[0.98] transition-all"
            >
              Cobrar {formatCLP(store.total)}
            </button>
          </div>
        )}
      </aside>

      {/* Modal checkout */}
      {store.checkoutOpen && (
        <CheckoutModal
          subtotal={store.subtotal}
          baesAmount={store.baesAmount}
          total={store.total}
          hasFrozen={store.hasFrozen}
          hasRefrigerated={store.hasRefrigerated}
          baesSession={store.baesSession}
          onBAESValidated={store.setBAESSession}
          onConfirm={handleConfirm}
          onClose={() => store.setCheckoutOpen(false)}
        />
      )}

    </div>
  )
}
