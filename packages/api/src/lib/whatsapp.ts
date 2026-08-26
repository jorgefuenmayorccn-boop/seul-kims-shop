// WhatsApp message templates — v1.0 usa wa.me links (sin Business API)
// v1.1: migrar a WhatsApp Cloud API con plantillas aprobadas

export const SEUL_WA_NUMBER = '56936451991'

function encodeWA(text: string): string {
  return encodeURIComponent(text.trim())
}

// Confirmación de pedido web (boleta emitida, PDF disponible)
export function buildOrderConfirmationWA(params: {
  numero:       number
  total:        number
  deliveryMode: string
  pdfUrl:       string
  folio?:       string
}): string {
  const { numero, total, deliveryMode, pdfUrl, folio } = params

  const mode =
    deliveryMode === 'metro'    ? '🚉 Retiro Metro Merval' :
    deliveryMode === 'rappi'    ? '🛵 Delivery Rappi' :
    deliveryMode === 'pickup'   ? '🏪 Retiro en tienda' :
    deliveryMode === 'shipping' ? '📦 Despacho a domicilio' :
    deliveryMode

  const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

  const msg = [
    '🇰🇷 *SEOUL KIMS* — Pedido confirmado',
    '',
    `Pedido *#${numero}*`,
    folio ? `Boleta electrónica *N° ${folio}*` : '',
    `Total: *${clp(total)}*`,
    `Modalidad: ${mode}`,
    '',
    `📄 Tu boleta PDF: ${pdfUrl}`,
    '_(El enlace vence en 48 horas)_',
    '',
    'Gracias por comprar en Seoul Kims 감사합니다! 🙏',
    '@seulshopcl · seoulkims.cl',
  ].filter(Boolean).join('\n')

  return `https://wa.me/${SEUL_WA_NUMBER}?text=${encodeWA(msg)}`
}

// Notificación interna — nuevo pedido para el dueño
export function buildOwnerNewOrderWA(params: {
  numero:   number
  total:    number
  channel:  string
  items:    number  // cantidad de ítems
}): string {
  const { numero, total, channel, items } = params
  const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

  const msg = [
    `🔔 Nuevo pedido *#${numero}* — ${channel.toUpperCase()}`,
    `${items} ítem${items !== 1 ? 's' : ''} · *${clp(total)}*`,
    'Ver en dashboard: seoulkims.cl/cerebro',
  ].join('\n')

  return `https://wa.me/${SEUL_WA_NUMBER}?text=${encodeWA(msg)}`
}

// Pedido B2B confirmado (va al comprador)
export function buildB2BOrderWA(params: {
  numero:      number
  razonSocial: string
  total:       number
  pdfUrl:      string
}): string {
  const { numero, razonSocial, total, pdfUrl } = params
  const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

  const msg = [
    '🇰🇷 *SEOUL KIMS — Portal Mayorista*',
    '',
    `Empresa: *${razonSocial}*`,
    `Pedido mayorista *#${numero}* confirmado`,
    `Total neto: *${clp(total)}*`,
    '',
    `📄 Factura/Boleta: ${pdfUrl}`,
    '_(El enlace vence en 48 horas)_',
    '',
    '¿Consultas? Responde este mensaje.',
    '@seulshopcl · seoulkims.cl',
  ].join('\n')

  return `https://wa.me/${SEUL_WA_NUMBER}?text=${encodeWA(msg)}`
}

// URL pública del PDF desde R2
export function buildPDFUrl(pdfToken: string): string {
  return `https://seoulkims.cl/boleta/${pdfToken}`
}
