'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, CheckCircle } from '@seul/icons'
import { Loader2 } from 'lucide-react'
import { DeliveryPicker, type DeliveryMode } from '@seul/ui/shop/delivery-picker'
import { CheckoutTimer } from '@seul/ui/shop/checkout-timer'
import { formatCLP } from '@seul/ui'
import { useCartStore, useCartSubtotal, useCartHasColdChain } from '@/lib/cart-store'
import { createWebOrder, upsertGuestCustomer, getCustomerSession } from '@/lib/api'
import { buildCheckoutMessage, getWhatsAppHref } from '@/lib/whatsapp'

export default function CheckoutPage() {
  const { items, clear } = useCartStore()
  const subtotal = useCartSubtotal()
  const hasColdChain = useCartHasColdChain()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  const [delivery, setDelivery]   = useState<DeliveryMode>('metro')
  const [station, setStation]     = useState<string>()
  const [slot, setSlot]           = useState<string>()
  const [loading, setLoading]     = useState(false)
  const [orderNumber, setOrderNumber] = useState<number>()
  const [apiError, setApiError]   = useState<string>()

  // Sesión activa
  const [sessionCustomerId, setSessionCustomerId] = useState<string | null>(null)
  const [otherRecipient, setOtherRecipient]       = useState(false)

  // Datos del comprador
  const [buyerName,  setBuyerName]  = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerAddr,  setBuyerAddr]  = useState('')

  // Autofill para usuario logueado
  useEffect(() => {
    getCustomerSession().then(({ ok, customer }) => {
      if (ok && customer) {
        setSessionCustomerId(customer.id)
        setBuyerName(customer.name)
        setBuyerEmail(customer.email)
      }
    }).catch(() => {})
  }, [])

  const needsAddress = delivery === 'shipping'
  const canContinue  = (
    buyerName.trim().length >= 2 &&
    buyerEmail.includes('@') &&
    (delivery !== 'metro' || (!!station && !!slot)) &&
    (!needsAddress || buyerAddr.trim().length > 5)
  )

  async function handleConfirm() {
    if (!canContinue || loading) return
    setLoading(true)
    setApiError(undefined)

    try {
      // 1. Resolver customerId — sesión activa o upsert guest
      let customerId: string
      if (sessionCustomerId && !otherRecipient) {
        customerId = sessionCustomerId
      } else {
        const guest = await upsertGuestCustomer({
          name:  buyerName.trim(),
          email: buyerEmail.trim(),
          phone: buyerPhone.trim() || undefined,
        })
        customerId = guest.customerId
      }

      // 2. Crear orden en DB y descontar inventario
      const result = await createWebOrder({
        channel:         'web',
        deliveryMode:    delivery,
        metroStation:    station,
        metroSlot:       slot,
        deliveryAddress: needsAddress ? buyerAddr.trim() : undefined,
        customerId,
        items: items.map(i => ({
          productId: i.id,
          quantity:  i.quantity,
          unitPrice: Math.round(Number(i.priceRetail)),
          isBaes:    false,
        })),
      })

      setOrderNumber(result.number)
      clear()

      // 3. Abrir WhatsApp con el resumen del pedido real
      const msg = buildCheckoutMessage(items, delivery, station, slot, result.number, subtotal)
      window.open(getWhatsAppHref(msg), '_blank', 'noopener,noreferrer')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar el pedido'
      setApiError(msg)
      // Graceful degradation — igual ofrecer WhatsApp manual
      const waMsg = buildCheckoutMessage(items, delivery, station, slot, undefined, subtotal)
      window.open(getWhatsAppHref(waMsg), '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  // Evitar flash de "carrito vacío" antes de que Zustand rehidrate desde localStorage
  if (!hydrated) return null

  // Carrito vacío
  if (items.length === 0 && !orderNumber) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span style={{ display: 'block', marginBottom: 16, fontSize: 40, fontFamily: 'var(--font-korean, serif)', color: 'var(--color-celadon, #6b8f71)', lineHeight: 1 }}>장바구니</span>
        <h1 className="font-headline text-2xl font-bold text-text mb-2">Tu carrito está vacío</h1>
        <p className="font-body text-text-muted mb-6">Agrega productos coreanos para continuar.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-headline font-semibold hover:bg-brand-hover transition-colors"
        >
          <ShoppingBag size={18} />
          Ver tienda
        </Link>
      </div>
    )
  }

  // Pedido confirmado
  if (orderNumber) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <CheckCircle className="size-16 text-success mx-auto mb-4" />
        <h1 className="font-headline text-2xl font-bold text-text mb-2">¡Pedido #{orderNumber} enviado!</h1>
        <p className="font-body text-text-muted mb-6 max-w-sm mx-auto">
          Abrimos WhatsApp con el resumen de tu pedido. Un representante te confirmará en menos de 15 minutos.
        </p>
        <Link href="/" className="text-brand font-body hover:underline">← Seguir comprando</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="text-sm text-text-muted font-body mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-text transition-colors">Inicio</Link>
        <span>/</span>
        <span className="text-text">Checkout</span>
      </nav>

      <h1 className="font-headline text-2xl font-bold text-text mb-6">Tu pedido</h1>
      <CheckoutTimer />

      <div className="mt-6 space-y-6">

        {/* Items del carrito */}
        <div className="bg-elevated rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-surface flex items-center justify-between">
            <p className="text-sm font-semibold font-body text-text">Productos</p>
            <Link href="/" className="text-xs text-brand font-body hover:underline">+ Agregar más</Link>
          </div>

          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0">
              {item.imageUrl && (
                <Image src={item.imageUrl} alt={item.name} width={48} height={48} className="rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body text-text line-clamp-1">{item.name}</p>
                <p className="text-xs text-text-muted font-mono">{item.quantity} × {formatCLP(item.priceRetail)}</p>
              </div>
              <p className="font-mono font-bold text-text shrink-0">{formatCLP(item.priceRetail * item.quantity)}</p>
            </div>
          ))}

          <div className="flex justify-between items-center px-4 py-3 bg-surface">
            <span className="font-headline font-bold text-text">Total</span>
            <span className="font-mono font-bold text-xl text-brand">{formatCLP(subtotal)}</span>
          </div>
        </div>

        {/* Datos del comprador */}
        <div className="bg-elevated rounded-xl border border-[var(--color-border)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-text text-lg">Tus datos de contacto</h2>
            {sessionCustomerId && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={otherRecipient}
                  onChange={e => setOtherRecipient(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-brand focus:ring-brand"
                />
                <span className="text-xs font-body text-text-muted">Enviar a alguien más</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Nombre completo <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="María González"
                readOnly={!!sessionCustomerId && !otherRecipient}
                className={`w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-text-muted/50 ${sessionCustomerId && !otherRecipient ? 'bg-[var(--color-surface-sunken)] cursor-default' : 'bg-surface'}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Correo electrónico <span className="text-brand">*</span>
              </label>
              <input
                type="email"
                value={buyerEmail}
                onChange={e => setBuyerEmail(e.target.value)}
                placeholder="maria@ejemplo.cl"
                readOnly={!!sessionCustomerId && !otherRecipient}
                className={`w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-text-muted/50 ${sessionCustomerId && !otherRecipient ? 'bg-[var(--color-surface-sunken)] cursor-default' : 'bg-surface'}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Teléfono (opcional)
              </label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={e => setBuyerPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-text-muted/50"
              />
            </div>
          </div>

          {needsAddress && (
            <div>
              <label className="block text-xs font-medium text-text-muted font-body mb-1">
                Dirección de despacho <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={buyerAddr}
                onChange={e => setBuyerAddr(e.target.value)}
                placeholder="Av. Libertad 1305, Viña del Mar"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-surface text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-text-muted/50"
              />
            </div>
          )}
        </div>

        {/* Entrega */}
        <div>
          <h2 className="font-headline font-bold text-text text-lg mb-4">¿Cómo prefieres recibir tu pedido?</h2>
          <DeliveryPicker
            mode={delivery}
            station={station}
            slot={slot}
            hasColdChain={hasColdChain}
            onChange={(m, s, sl) => { setDelivery(m); setStation(s); setSlot(sl) }}
          />
        </div>

        {/* Pago */}
        <div className="bg-[var(--color-channel-whatsapp)]/5 border border-[var(--color-channel-whatsapp)]/20 rounded-xl p-5">
          <p className="font-semibold font-body text-text mb-1">Pago y confirmación</p>
          <p className="text-sm text-text-muted font-body">
            Confirmamos tu pedido y coordinamos el pago por WhatsApp.
            Aceptamos efectivo, transferencia y Transbank.
          </p>
        </div>

        {/* Error banner */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700 font-body">
              <span className="font-semibold">Hubo un problema al registrar tu pedido.</span>{' '}
              Tu pedido fue enviado por WhatsApp de todos modos. Error: {apiError}
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleConfirm}
          disabled={!canContinue || loading}
          className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl font-headline font-bold text-lg transition-opacity ${
            canContinue && !loading
              ? 'bg-[var(--color-channel-whatsapp)] text-white hover:opacity-90 cursor-pointer'
              : 'bg-[var(--ink-100)] text-text-muted cursor-not-allowed'
          }`}
        >
          {loading ? (
            <><Loader2 size={20} className="animate-spin" /> Procesando pedido...</>
          ) : canContinue ? (
            <>Confirmar pedido por WhatsApp</>
          ) : (
            'Completa tus datos para continuar'
          )}
        </button>

        <p className="text-xs text-center text-text-muted font-body">
          Al enviar el mensaje aceptas nuestros{' '}
          <a href="/terminos" className="underline hover:text-text transition-colors">términos y condiciones</a>
          {' '}y la{' '}
          <a href="/privacidad" className="underline hover:text-text transition-colors">política de privacidad</a>
          {' '}(Ley 21.719)
        </p>

      </div>
    </div>
  )
}
