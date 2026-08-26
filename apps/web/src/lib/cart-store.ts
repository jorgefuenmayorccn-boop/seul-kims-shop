import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id:             string
  slug:           string
  name:           string
  nameKo?:        string | null
  brand?:         string | null
  imageUrl?:      string | null
  priceRetail:    number
  coldChain:      'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean
  quantity:       number
}

interface CartState {
  items: CartItem[]
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      addItem: (product, qty = 1) => {
        const existing = get().items.find(i => i.id === product.id)
        if (existing) {
          set(s => ({
            items: s.items.map(i =>
              i.id === product.id ? { ...i, quantity: i.quantity + qty } : i
            ),
          }))
        } else {
          set(s => ({ items: [...s.items, { ...product, quantity: qty }] }))
        }
      },

      removeItem: (id) =>
        set(s => ({ items: s.items.filter(i => i.id !== id) })),

      updateQty: (id, qty) => {
        if (qty <= 0) {
          set(s => ({ items: s.items.filter(i => i.id !== id) }))
        } else {
          set(s => ({
            items: s.items.map(i => i.id === id ? { ...i, quantity: qty } : i),
          }))
        }
      },

      clear: () => set({ items: [] }),
    }),
    {
      name: 'seul-cart-v1',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Selectores derivados
export const useCartSubtotal = () =>
  useCartStore(s => s.items.reduce((acc, i) => acc + i.priceRetail * i.quantity, 0))

export const useCartItemCount = () =>
  useCartStore(s => s.items.reduce((acc, i) => acc + i.quantity, 0))

export const useCartHasColdChain = () =>
  useCartStore(s => s.items.some(i => i.coldChain !== 'ambient'))

export const useCartHasFrozen = () =>
  useCartStore(s => s.items.some(i => i.coldChain === 'frozen'))

export const useCartHasHydrated = () => useCartStore(s => s.hasHydrated)
