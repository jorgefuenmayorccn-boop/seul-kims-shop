import type { CartItem } from './cart-store'
import { formatCLP } from '@seul/ui'

const SEUL_WA = '56936451991'

export function buildCheckoutMessage(
  items: CartItem[],
  deliveryMode: string,
  station?: string,
  slot?: string,
  orderNumber?: number,
  subtotal?: number
): string {
  const lines = items.map(i => `• ${i.quantity}x ${i.name}: ${formatCLP(i.priceRetail * i.quantity)}`).join('\n')
  const total = subtotal ?? items.reduce((acc, i) => acc + i.priceRetail * i.quantity, 0)

  const deliveryLine =
    deliveryMode === 'metro'   ? `Retiro Metro Merval — ${station ?? '?'} ${slot ? `(${slot})` : ''}` :
    deliveryMode === 'rappi'   ? 'Rappi Express' :
    deliveryMode === 'pickup'  ? 'Retiro en tienda' :
    'Despacho a regiones'

  const header = orderNumber ? `*Pedido #${orderNumber}*\n\n` : ''

  return `${header}¡Hola! Quiero confirmar este pedido.\n\n${lines}\n\n*Total: ${formatCLP(total)}*\nEntrega: ${deliveryLine}\n\n¿Me confirman disponibilidad?`
}

export function getWhatsAppHref(message: string): string {
  return `https://wa.me/${SEUL_WA}?text=${encodeURIComponent(message)}`
}
