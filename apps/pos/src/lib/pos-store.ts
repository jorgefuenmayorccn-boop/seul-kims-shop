'use client'
import { useState, useCallback, useRef } from 'react'
import type { CartItem } from '@seul/ui/pos/cart-line'

export interface BAESSession {
  name: string
  rut:  string
}

export interface DeliveryOrderInfo {
  customerId?:     string
  guestName?:      string
  guestPhone?:     string
  guestEmail?:     string
  deliveryAddress?: string
  // Comuna/zona separada de la calle (adición post-entrega, 3-sep-2026 — el
  // dueño pidió una dirección más específica, no todo en un campo libre).
  comuna?:         string
  deliveryFloor?:  string
  deliveryApt?:    string
  deliveryRefs?:   string
  deliveryMode:    'delivery' | 'rappi'
  paymentAtDoor:   boolean
}

export interface POSProduct {
  id:             string
  name:           string
  sku:            string
  barcode?:       string | null
  brand?:         string | null
  priceRetail:    number
  // Solo llegan con sesión de staff (GET /api/products ya los expone así,
  // ver server.ts) — necesarios para venta B2B presencial (adición
  // post-entrega, punto 6 del flujo de aprobación de crédito B2B).
  pricePOS?:      number | null
  priceB2B?:      number | null
  coldChain:      'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean
  isWeighable:    boolean
  stockTotal:     number
  imageUrl?:      string | null
  categoryId?:    string | null
}

// Empresa B2B seleccionada para una venta presencial en POS (adición
// post-entrega, pedido explícito del dueño: "un cliente mayorista que llega
// físicamente a comprar debe poder ser atendido en POS con precios B2B").
// Opcional — un toggle, no un modo obligatorio; nunca rompe el flujo normal
// de venta cuando no hay empresa seleccionada.
export interface B2BCompanyInfo {
  id:          string
  razonSocial: string
  rut:         string
  status:      string
}

export function usePOSStore() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [baesSession, setBAESSession] = useState<BAESSession | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [deliveryOrder, setDeliveryOrder] = useState<DeliveryOrderInfo | null>(null)
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1)
  // Venta B2B presencial (adición post-entrega) — cuando hay una empresa
  // seleccionada, addProduct usa priceB2B en vez de priceRetail. Se limpia
  // junto con el carrito (clearCart) para no arrastrar precios mayoristas a
  // la siguiente venta por accidente.
  const [b2bCompany, setB2BCompany] = useState<B2BCompanyInfo | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const addProduct = useCallback((product: POSProduct, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      const unitPrice = b2bCompany && product.priceB2B != null
        ? product.priceB2B
        : product.priceRetail
      if (existing && !product.isWeighable) {
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, {
        id:          product.id,
        name:        product.name,
        quantity,
        unitPrice,
        isWeighable: product.isWeighable,
        isBaes:      product.isBaesEligible,
        coldChain:   product.coldChain,
      }]
    })
    setSelectedCartIndex(-1)
  }, [b2bCompany])

  const removeProduct = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
    setSelectedCartIndex(-1)
  }, [])

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id))
    } else {
      setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
    }
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setBAESSession(null)
    setCheckoutOpen(false)
    setDeliveryOrder(null)
    setSelectedCartIndex(-1)
    setB2BCompany(null)
  }, [])

  // Navegar carrito con teclado
  const cartUp = useCallback(() => {
    setSelectedCartIndex(prev => Math.max(0, prev - 1))
  }, [])

  const cartDown = useCallback(() => {
    setSelectedCartIndex(prev => {
      setCart(cart => {
        const max = cart.length - 1
        return cart
      })
      return Math.min(cart.length - 1, prev + 1)
    })
  }, [cart.length])

  const increaseSelected = useCallback(() => {
    setCart(prev => {
      if (selectedCartIndex < 0 || selectedCartIndex >= prev.length) return prev
      return prev.map((item, i) =>
        i === selectedCartIndex ? { ...item, quantity: item.quantity + 1 } : item
      )
    })
  }, [selectedCartIndex])

  const decreaseSelected = useCallback(() => {
    setCart(prev => {
      if (selectedCartIndex < 0 || selectedCartIndex >= prev.length) return prev
      const item = prev[selectedCartIndex]
      if (item.quantity <= 1) return prev.filter((_, i) => i !== selectedCartIndex)
      return prev.map((it, i) =>
        i === selectedCartIndex ? { ...it, quantity: it.quantity - 1 } : it
      )
    })
  }, [selectedCartIndex])

  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const baesAmount = baesSession
    ? cart.filter(i => i.isBaes).reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
    : 0
  const total = subtotal - baesAmount

  const hasColdChain    = cart.some(i => i.coldChain !== 'ambient')
  const hasFrozen       = cart.some(i => i.coldChain === 'frozen')
  const hasRefrigerated = cart.some(i => i.coldChain === 'refrigerated')
  const itemCount       = cart.reduce((acc, i) => acc + Math.ceil(i.quantity), 0)

  return {
    cart, addProduct, removeProduct, updateQuantity, clearCart,
    baesSession, setBAESSession,
    checkoutOpen, setCheckoutOpen,
    deliveryOrder, setDeliveryOrder,
    b2bCompany, setB2BCompany,
    selectedCartIndex, setSelectedCartIndex,
    cartUp, cartDown, increaseSelected, decreaseSelected,
    focusSearch, searchRef,
    subtotal, baesAmount, total,
    hasColdChain, hasFrozen, hasRefrigerated, itemCount,
  }
}
