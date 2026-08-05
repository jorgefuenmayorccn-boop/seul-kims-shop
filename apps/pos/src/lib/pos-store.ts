'use client'
import { useState, useCallback } from 'react'
import type { CartItem } from '@seul/ui/pos/cart-line'

export interface BAESSession {
  name: string
  rut: string
}

export function usePOSStore() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [baesSession, setBAESSession] = useState<BAESSession | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const addProduct = useCallback((product: {
    id: string
    name: string
    priceRetail: number
    isWeighable: boolean
    isBaesEligible: boolean
    coldChain: 'ambient' | 'refrigerated' | 'frozen'
  }, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing && !product.isWeighable) {
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, {
        id:          product.id,
        name:        product.name,
        quantity,
        unitPrice:   product.priceRetail,
        isWeighable: product.isWeighable,
        isBaes:      product.isBaesEligible,
        coldChain:   product.coldChain,
      }]
    })
  }, [])

  const removeProduct = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
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
  }, [])

  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const baesAmount = baesSession
    ? cart.filter(i => i.isBaes).reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
    : 0
  const total = subtotal - baesAmount

  const hasColdChain = cart.some(i => i.coldChain !== 'ambient')
  const hasFrozen     = cart.some(i => i.coldChain === 'frozen')
  const hasRefrigeated = cart.some(i => i.coldChain === 'refrigerated')

  return {
    cart, addProduct, removeProduct, updateQuantity, clearCart,
    baesSession, setBAESSession,
    checkoutOpen, setCheckoutOpen,
    subtotal, baesAmount, total,
    hasColdChain, hasFrozen, hasRefrigerated: hasRefrigeated,
    itemCount: cart.reduce((acc, i) => acc + Math.ceil(i.quantity), 0),
  }
}
