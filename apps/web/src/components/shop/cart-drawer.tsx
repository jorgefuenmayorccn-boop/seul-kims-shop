'use client'
import { X } from '@seul/icons'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore, useCartSubtotal } from '@/lib/cart-store'
import { useCartUIStore } from '@/lib/cart-ui-store'
import { formatCLP } from '@seul/ui'

const SPRING = { type: 'spring', stiffness: 380, damping: 40 } as const

export function CartDrawer() {
  const { drawerOpen, closeDrawer } = useCartUIStore()
  const { items, updateQty, removeItem } = useCartStore()
  const subtotal = useCartSubtotal()

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-heuk-950/50 backdrop-blur-sm"
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SPRING}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col shadow-xl"
            style={{
              background: 'var(--color-baek-pure, var(--baek-50))',
              borderLeft: 'var(--border-editorial)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: 'var(--border-editorial)' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-korean font-black text-xl"
                  style={{ color: 'var(--color-seoul-red)' }}
                >
                  장바구니
                </span>
                <span
                  className="font-body text-xs tracking-widest"
                  style={{ color: 'var(--color-heuk)', opacity: 0.4, letterSpacing: '0.14em' }}
                >
                  CARRITO
                </span>
                {items.length > 0 && (
                  <span
                    className="ml-1 font-mono text-xs font-bold px-2 py-0.5"
                    style={{ background: 'var(--color-seoul-red)', color: 'var(--color-baek)' }}
                  >
                    {items.length}
                  </span>
                )}
              </div>
              <motion.button
                onClick={closeDrawer}
                whileTap={{ scale: 0.88 }}
                className="p-2 transition-colors"
                style={{ color: 'var(--color-heuk)' }}
                aria-label="Cerrar carrito"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-5 px-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full gap-5 text-center py-16"
                  >
                    <span
                      className="font-korean text-5xl font-black"
                      style={{ color: 'var(--color-celadon)', opacity: 0.3 }}
                    >
                      빈
                    </span>
                    <div>
                      <p
                        className="font-body font-semibold text-sm"
                        style={{ color: 'var(--color-heuk)' }}
                      >
                        Tu carrito está vacío
                      </p>
                      <p
                        className="font-korean text-xs mt-1"
                        style={{ color: 'var(--color-heuk)', opacity: 0.4 }}
                      >
                        아직 비어있어요
                      </p>
                    </div>
                    <button
                      onClick={closeDrawer}
                      className="font-body text-xs tracking-widest hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-seoul-red)', letterSpacing: '0.12em', opacity: 0.8 }}
                    >
                      SEGUIR COMPRANDO →
                    </button>
                  </motion.div>
                ) : (
                  items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ ...SPRING, delay: i * 0.04 }}
                      className="flex gap-4"
                      style={{ borderBottom: 'var(--border-editorial)', paddingBottom: '1rem' }}
                    >
                      {/* Imagen cuadrada editorial */}
                      <div
                        className="relative shrink-0 overflow-hidden"
                        style={{ width: 72, height: 72, background: 'var(--color-celadon-light)' }}
                      >
                        {item.imageUrl ? (
                          <div className="relative w-full h-full">
                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="80px" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-korean text-lg" style={{ color: 'var(--color-celadon)' }}>식</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {item.brand && (
                          <span
                            className="font-body text-[10px] tracking-widest uppercase"
                            style={{ color: 'var(--color-celadon)', letterSpacing: '0.14em' }}
                          >
                            {item.brand}
                          </span>
                        )}
                        <p
                          className="font-body font-semibold text-sm leading-snug line-clamp-2"
                          style={{ color: 'var(--color-heuk)' }}
                        >
                          {item.name}
                        </p>
                        {item.nameKo && (
                          <p className="font-korean text-[10px]" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
                            {item.nameKo}
                          </p>
                        )}
                        <p className="font-mono font-bold text-sm" style={{ color: 'var(--color-seoul-red)' }}>
                          {formatCLP(item.priceRetail)}
                        </p>

                        {/* Cantidad */}
                        <div className="flex items-center gap-3 mt-1">
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center font-mono text-xs transition-colors"
                            style={{ border: 'var(--border-editorial)', color: 'var(--color-heuk)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </motion.button>
                          <span className="font-mono font-bold text-sm w-6 text-center" style={{ color: 'var(--color-heuk)' }}>
                            {item.quantity}
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center font-mono text-xs transition-colors"
                            style={{ border: 'var(--border-editorial)', color: 'var(--color-heuk)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => removeItem(item.id)}
                            className="ml-auto transition-colors"
                            style={{ color: 'var(--color-heuk)', opacity: 0.35 }}
                            aria-label="Eliminar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </motion.button>
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-bold text-sm" style={{ color: 'var(--color-heuk)' }}>
                          {formatCLP(item.priceRetail * item.quantity)}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <AnimatePresence>
              {items.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING}
                  className="px-6 py-5 space-y-4"
                  style={{ borderTop: 'var(--border-editorial)' }}
                >
                  {/* Barra de envío gratis */}
                  <div className="space-y-2">
                    {subtotal >= 25000 ? (
                      <p className="font-body text-xs font-semibold" style={{ color: 'var(--color-brand)' }}>
                        Envio gratis desbloqueado
                      </p>
                    ) : (
                      <>
                        <p className="font-body text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.6 }}>
                          Te faltan{' '}
                          <span className="font-mono font-bold" style={{ opacity: 1, color: 'var(--color-heuk)' }}>
                            {formatCLP(25000 - subtotal)}
                          </span>
                          {' '}para envio gratis
                        </p>
                        <div
                          className="w-full rounded-full overflow-hidden"
                          style={{ height: 4, background: 'var(--color-celadon-light)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((subtotal / 25000) * 100, 100)}%`,
                              background: 'var(--color-brand)',
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="font-body text-xs tracking-widest" style={{ color: 'var(--color-heuk)', opacity: 0.5, letterSpacing: '0.14em' }}>
                        SUBTOTAL
                      </span>
                      <p className="font-korean text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.35 }}>소계</p>
                    </div>
                    <span className="font-mono font-black text-2xl" style={{ color: 'var(--color-heuk)' }}>
                      {formatCLP(subtotal)}
                    </span>
                  </div>
                  <p className="font-body text-xs" style={{ color: 'var(--color-heuk)', opacity: 0.4 }}>
                    Envío y pago se confirman por WhatsApp
                  </p>
                  <Link
                    href="/checkout"
                    onClick={closeDrawer}
                    className="flex items-center justify-center gap-3 w-full py-4 font-body font-semibold text-sm tracking-widest transition-colors"
                    style={{
                      background: 'var(--color-heuk)',
                      color: 'var(--color-baek)',
                      letterSpacing: '0.14em',
                    }}
                  >
                    <span>IR AL CHECKOUT</span>
                    <span className="font-korean text-base">→</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
