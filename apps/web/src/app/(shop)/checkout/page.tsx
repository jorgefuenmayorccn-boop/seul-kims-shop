'use client'
import { useState } from 'react'
import { DeliveryPicker, type DeliveryMode } from '@seul/ui/shop/delivery-picker'
import { CheckoutTimer } from '@seul/ui/shop/checkout-timer'
import { WhatsAppCTA, cn, formatCLP } from '@seul/ui'

// Checkout B2C — v1.0: flujo manual via WhatsApp
// v1.2: integración Webpay Plus / Fintoc
export default function CheckoutPage() {
  const [delivery, setDelivery] = useState<DeliveryMode>('metro')
  const [station, setStation] = useState<string>()
  const [slot, setSlot] = useState<string>()
  const [step, setStep] = useState<'delivery' | 'summary'>('delivery')

  // En v1.0 el carrito está en KV del API — aquí mock para el flujo
  const mockItems = [
    { id: '1', name: 'Kimchi Jongga 500g', quantity: 1, price: 6990, coldChain: 'refrigerated' as const },
    { id: '2', name: 'Ramen Shin Ramyun x5', quantity: 2, price: 3490, coldChain: 'ambient' as const },
  ]
  const hasColdChain = mockItems.some(i => i.coldChain !== 'ambient')
  const subtotal = mockItems.reduce((acc, i) => acc + i.price * i.quantity, 0)

  // Mensaje WhatsApp con detalle del pedido
  const orderLines = mockItems.map(i => `• ${i.quantity}x ${i.name}: ${formatCLP(i.price * i.quantity)}`).join('\n')
  const deliveryLine = delivery === 'metro'
    ? `Retiro Metro Merval — ${station ?? 'sin estación'} ${slot ? `(${slot})` : ''}`
    : delivery === 'rappi' ? 'Rappi Express'
    : delivery === 'pickup' ? 'Retiro en tienda'
    : 'Despacho a regiones'
  const waMessage = `¡Hola! Quiero hacer este pedido 🥢\n\n${orderLines}\n\nTotal: ${formatCLP(subtotal)}\nEntrega: ${deliveryLine}\n\n¿Me confirman disponibilidad?`

  const canContinue = delivery !== 'metro' || (!!station && !!slot)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="text-sm text-text-muted font-body mb-6">
        <a href="/" className="hover:text-text transition-colors">Inicio</a>
        <span className="mx-2">/</span>
        <span className="text-text">Checkout</span>
      </nav>

      <h1 className="font-headline text-2xl font-bold text-text mb-6">Tu pedido</h1>

      {/* Timer */}
      <CheckoutTimer />

      <div className="mt-6 space-y-6">

        {/* Items */}
        <div className="bg-elevated rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-surface">
            <p className="text-sm font-semibold font-body text-text">Productos</p>
          </div>
          {mockItems.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] last:border-0">
              <div>
                <p className="text-sm font-body text-text">{item.name}</p>
                <p className="text-xs text-text-muted font-mono">{item.quantity} × {formatCLP(item.price)}</p>
              </div>
              <p className="font-mono font-bold text-text">{formatCLP(item.price * item.quantity)}</p>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-surface">
            <span className="font-headline font-bold text-text">Total</span>
            <span className="font-mono font-bold text-xl text-brand">{formatCLP(subtotal)}</span>
          </div>
        </div>

        {/* Entrega */}
        <div>
          <h2 className="font-headline font-bold text-text text-lg mb-4">¿Cómo prefieres recibir tu pedido?</h2>
          <DeliveryPicker
            mode={delivery}
            station={station}
            slot={slot}
            hasColdChain={hasColdChain}
            onChange={(m, s, sl) => {
              setDelivery(m)
              setStation(s)
              setSlot(sl)
            }}
          />
        </div>

        {/* Método de pago — v1.0 solo WhatsApp */}
        <div className="bg-[var(--color-channel-whatsapp)]/5 border border-[var(--color-channel-whatsapp)]/20 rounded-xl p-5">
          <p className="font-semibold font-body text-text mb-1">Pago y confirmación</p>
          <p className="text-sm text-text-muted font-body">
            En esta versión confirmamos tu pedido y coordinamos el pago por WhatsApp.
            Aceptamos efectivo, transferencia y Transbank.
          </p>
        </div>

        {/* CTA — enviar por WhatsApp */}
        {canContinue ? (
          <a
            href={`https://wa.me/56936451991?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-[var(--color-channel-whatsapp)] text-white font-headline font-bold text-lg hover:opacity-90 transition-opacity"
          >
            <span className="text-2xl">💬</span>
            Confirmar pedido por WhatsApp
          </a>
        ) : (
          <button
            disabled
            className="w-full py-4 rounded-xl bg-[var(--ink-100)] text-text-muted font-headline font-bold text-lg cursor-not-allowed"
          >
            Selecciona estación y franja horaria
          </button>
        )}

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
