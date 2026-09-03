// Comprobante de venta POS — 3 variantes: nota_venta, boleta, factura
// Estética: quiet luxury monospace — jerarquía tipográfica de 5 niveles

import {
  htmlShell, storeHeader, storeFooter,
  clp, formatDateTime, padNum,
  channelLabel, metodoPagoLabel, dteStatusText, deliveryLabel,
  INK,
} from './design-system'
import type { TicketPayload } from '../ticket-payload'

// CSS adicional específico para comprobante POS
const RECEIPT_CSS = `
.order-num-block {
  text-align: center;
  padding: 8px 0 6px;
}
.order-num-block .doc-type { margin-bottom: 6px; }
.order-num-block .anchor-num { display: block; }
.order-num-block .meta { margin-top: 4px; }

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.item-row .left {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.item-row .left .item-qty { flex-shrink: 0; }
.item-row .left .item-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-row .item-price { flex-shrink: 0; text-align: right; min-width: 48px; }

.totals-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.baes-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: ${INK[500]};
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 5px;
  margin-top: 4px;
  border-top: 1px solid ${INK[100]};
}

.payment-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.payment-row.change-row { color: ${INK[500]}; }

.receiver-block {
  background: #f9f9f9;
  border-left: 2px solid ${INK[100]};
  padding: 6px 8px;
  margin: 6px 0;
}

.reprint-banner {
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: ${INK[300]};
  border: 1px dashed ${INK[100]};
  padding: 4px 0;
  margin-bottom: 8px;
}

.folio-block {
  text-align: center;
  margin: 4px 0;
}
.folio-num {
  font-size: 11px;
  font-weight: 700;
  color: ${INK[700]};
  letter-spacing: 0.06em;
}
`

export function renderPosReceiptHtml(p: TicketPayload): string {
  const isFactura    = p.ticketType === 'factura'
  const isBoleta     = p.ticketType === 'boleta'
  const isNotaVenta  = p.ticketType === 'nota_venta'
  const hasBaes      = p.baesAmount > 0
  const hasReceiver  = isFactura && p.receiver

  const docTypeLabel = isFactura   ? 'FACTURA ELECTRÓNICA'
                     : isBoleta    ? 'BOLETA ELECTRÓNICA'
                     : 'NOTA DE VENTA'

  const docSubLabel  = isFactura   ? 'Documento tributario N° 33'
                     : isBoleta    ? 'Documento tributario N° 39'
                     : 'Comprobante interno — no es doc. tributario'

  // ─── Contexto operacional ─────────────────────────────────────────────────
  const contextParts: string[] = []
  if (p.cashier)            contextParts.push(p.cashier)
  if (p.tillSessionNumber)  contextParts.push(`Caja #${p.tillSessionNumber}`)
  if (p.shiftNumber)        contextParts.push(`Turno #${p.shiftNumber}`)
  const contextLine = contextParts.join(' · ')

  // ─── Items ────────────────────────────────────────────────────────────────
  const itemsHtml = p.items.map(item => {
    const sellosHtml = item.sellos && item.sellos.length > 0
      ? `<div class="indent meta sello mt-1">${item.sellos.map(s => `[${s.toUpperCase()}]`).join(' ')}</div>`
      : ''
    const baesHtml = item.isBaes
      ? `<div class="indent baes-badge mt-1">✦ BAES JUNAEB</div>`
      : ''
    const unitPriceHtml = item.qty > 1
      ? `<div class="indent unit-price">${clp(item.unitPrice)} c/u</div>`
      : ''

    return `
<div class="mb-1">
  <div class="item-row">
    <div class="left">
      <span class="item-qty">${item.qty}</span>
      <span class="item-name">${escHtml(item.name)}</span>
    </div>
    <span class="item-price">${clp(item.subtotal)}</span>
  </div>
  ${unitPriceHtml}${baesHtml}${sellosHtml}
</div>`
  }).join('')

  // ─── Totales ──────────────────────────────────────────────────────────────
  const taxHtml = isFactura
    ? `<div class="totals-row meta mt-1"><span>IVA (19%)</span><span>${clp(Math.round(p.total * 0.19 / 1.19))}</span></div>`
    : ''

  const totalsHtml = `
<div class="totals-row"><span class="meta">Subtotal</span><span class="meta">${clp(p.subtotal)}</span></div>
${hasBaes ? `<div class="baes-row mt-1"><span class="meta">BAES JUNAEB (−)</span><span class="meta">−${clp(p.baesAmount)}</span></div>` : ''}
${taxHtml}
<div class="total-row">
  <span class="total-label">TOTAL</span>
  <span class="total-value">${clp(p.total)}</span>
</div>`

  // ─── Pagos ────────────────────────────────────────────────────────────────
  const paymentsHtml = p.payments.map(pay => `
<div class="payment-row mt-1">
  <span class="meta">${escHtml(metodoPagoLabel(pay.method) || pay.label)}</span>
  <span class="meta-strong">${clp(pay.amount)}</span>
</div>`).join('')

  const cashLine = p.cashReceived != null && p.cashReceived > 0
    ? `<div class="payment-row mt-2"><span class="meta">Recibido en efectivo</span><span class="meta">${clp(p.cashReceived)}</span></div>`
    : ''

  const changeLine = p.change != null && p.change > 0
    ? `<div class="payment-row change-row mt-1"><span class="meta">Vuelto</span><span class="meta">−${clp(p.change)}</span></div>`
    : ''

  // ─── Receptor (solo factura) ──────────────────────────────────────────────
  const receiverHtml = hasReceiver ? `
<hr class="sep">
<div class="section-lbl mb-2">Datos del receptor</div>
<div class="receiver-block">
  <div class="meta-strong">${escHtml(p.receiver!.razonSocial)}</div>
  <div class="meta">RUT: ${escHtml(p.receiver!.rut)}</div>
  <div class="meta">${escHtml(p.receiver!.giro)}</div>
  <div class="meta">${escHtml(p.receiver!.direccion)}, ${escHtml(p.receiver!.comuna)}</div>
</div>` : ''

  // ─── Entrega (adición post-entrega, 3-sep-2026) ─────────────────────────
  // Antes la boleta/nota de venta nunca mostraba dónde/cuándo se entrega un
  // pedido — solo la comanda y la etiqueta (documentos internos) lo tenían.
  // 'pickup' no muestra bloque — el cliente retira en tienda, ya lo dice el
  // encabezado del canal.
  const deliveryHtml = (() => {
    if (!p.deliveryMode || p.deliveryMode === 'pickup') return ''
    const lines: string[] = []
    if (p.deliveryMode === 'metro' && p.metroStation) {
      lines.push(`Estación ${escHtml(p.metroStation)}`)
      const parts: string[] = []
      if (p.deliveryDate) parts.push(escHtml(formatDeliveryDate(p.deliveryDate)))
      if (p.metroSlot) parts.push(escHtml(p.metroSlot))
      if (parts.length) lines.push(parts.join(' · '))
    } else if (p.deliveryAddress) {
      lines.push(escHtml(p.deliveryAddress))
      if (p.deliveryComuna) lines.push(escHtml(p.deliveryComuna))
    }
    if (lines.length === 0) return ''
    return `
<hr class="sep">
<div class="section-lbl mb-2">Entrega — ${deliveryLabel(p.deliveryMode)}</div>
<div class="receiver-block">
  ${lines.map(l => `<div class="meta">${l}</div>`).join('')}
</div>`
  })()

  // ─── Folio SII ───────────────────────────────────────────────────────────
  const folioHtml = p.folio ? `
<div class="folio-block mt-1">
  <span class="doc-type">N° Folio SII: </span>
  <span class="folio-num">${escHtml(p.folio)}</span>
</div>` : ''

  // ─── Badge DTE ───────────────────────────────────────────────────────────
  const dteText = dteStatusText(p.dteStatus)
  const dteBadgeHtml = dteText
    ? `<div class="center dte-badge mt-3 mb-1">${dteText}</div>`
    : ''

  // ─── Reimpresión ──────────────────────────────────────────────────────────
  const reprintBanner = p.isReprint
    ? `<div class="reprint-banner mb-3">✦ &nbsp; C O P I A &nbsp; ✦</div>`
    : ''

  const body = `
${reprintBanner}
${storeHeader(p.storeInfo)}

<hr class="sep">

<div class="order-num-block">
  <div class="doc-type">${docTypeLabel}</div>
  ${isNotaVenta ? `<div class="dte-badge mt-1">No es documento tributario</div>` : ''}
  ${folioHtml}
  <span class="anchor-num">#${padNum(p.number)}</span>
  <div class="meta mt-2">${formatDateTime(p.date)}</div>
  ${contextLine ? `<div class="meta mt-1">${escHtml(contextLine)}</div>` : ''}
</div>

${receiverHtml}
${deliveryHtml}

<hr class="sep">
<div class="section-lbl mb-2">Productos</div>

${itemsHtml}

<hr class="sep-light">

<div class="pt-2">
${totalsHtml}
</div>

<hr class="sep">
<div class="section-lbl mb-2">Pago</div>

${paymentsHtml}
${cashLine}
${changeLine}

${dteBadgeHtml}

<hr class="sep">

<div class="center meta mt-2">
  <div>${escHtml(channelLabel(p.ticketType === 'nota_venta' ? 'pos' : 'pos'))}</div>
  <div class="mt-1" style="font-size:8px;color:${INK[300]};">${docSubLabel}</div>
</div>

${storeFooter(p.storeInfo)}
`

  return htmlShell(
    `Comprobante #${padNum(p.number)} · Seoul Kims`,
    body,
    RECEIPT_CSS,
  )
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// yyyy-mm-dd → "Vie 05/09" — mismo helper que comanda.ts/etiqueta.ts.
function formatDeliveryDate(isoDate: string): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d.getTime())) return isoDate
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
