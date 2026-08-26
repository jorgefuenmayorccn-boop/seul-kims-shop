// Comanda de Producción — Kitchen/Prep Ticket
// Diseño optimizado para lectura desde 2 metros: número de pedido dominante
// Sin precios — solo lo que el equipo de preparación necesita

import {
  htmlShell,
  formatTime,
  channelLabel, deliveryLabel,
  INK,
} from './design-system'
import type { ComandaPayload } from '../ticket-payload'

const COMANDA_CSS = `
body { background: ${INK.paper}; }

.comanda-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 8px;
}
.brand-mini {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: ${INK[700]};
  text-transform: uppercase;
}
.channel-pill {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: ${INK[300]};
  text-align: right;
  line-height: 1.6;
}

/* El ancla visual máxima — número de pedido */
.order-number-block {
  text-align: center;
  padding: 10px 0 8px;
  border-top: 2px solid ${INK[900]};
  border-bottom: 2px solid ${INK[900]};
  margin: 4px 0 10px;
}
.order-number-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: ${INK[300]};
  text-transform: uppercase;
  margin-bottom: 4px;
}
.order-number-value {
  font-size: 48px;
  font-weight: 900;
  color: ${INK[900]};
  line-height: 1.0;
  letter-spacing: -0.02em;
}

/* Items */
.item-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed ${INK[100]};
}
.item-line:last-child { border-bottom: none; }
.item-qty-badge {
  font-size: 14px;
  font-weight: 900;
  color: ${INK[900]};
  min-width: 28px;
  flex-shrink: 0;
  line-height: 1;
}
.item-name-text {
  font-size: 12px;
  font-weight: 500;
  color: ${INK[700]};
  line-height: 1.3;
  flex: 1;
}
.item-note {
  font-size: 10px;
  font-weight: 400;
  color: ${INK[500]};
  font-style: italic;
  padding: 2px 0 2px 36px;
}

/* Delivery info */
.delivery-block {
  border: 1px solid ${INK[900]};
  padding: 6px 8px;
  margin-top: 8px;
}
.delivery-mode {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.10em;
  color: ${INK[900]};
  text-transform: uppercase;
}
.delivery-detail {
  font-size: 9px;
  color: ${INK[500]};
  margin-top: 2px;
}

/* Nota general */
.order-note-block {
  margin-top: 8px;
  padding: 6px 8px;
  background: #f5f5f5;
  border-left: 3px solid ${INK[900]};
}
.order-note-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: ${INK[300]};
  text-transform: uppercase;
  margin-bottom: 2px;
}
.order-note-text {
  font-size: 11px;
  color: ${INK[700]};
}

/* Cashier footer */
.comanda-footer {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: ${INK[300]};
  border-top: 1px solid ${INK[100]};
  padding-top: 6px;
}
`

export function renderComandaHtml(c: ComandaPayload): string {
  const channel  = channelLabel(c.channel)
  const time     = formatTime(c.createdAt)

  // ─── Items ────────────────────────────────────────────────────────────────
  const itemsHtml = c.items.map(item => {
    const noteHtml = item.notes
      ? `<div class="item-note">↳ ${escHtml(item.notes)}</div>`
      : ''
    return `
<div>
  <div class="item-line">
    <span class="item-qty-badge">${item.qty}×</span>
    <span class="item-name-text">${escHtml(item.name)}</span>
  </div>
  ${noteHtml}
</div>`
  }).join('')

  // ─── Delivery block ───────────────────────────────────────────────────────
  let deliveryDetail = ''
  if (c.deliveryMode === 'metro' && c.metroStation) {
    deliveryDetail = `<div class="delivery-detail">Estación ${escHtml(c.metroStation)}`
    if (c.metroSlot) deliveryDetail += ` · ${escHtml(c.metroSlot)}`
    deliveryDetail += '</div>'
  } else if (c.deliveryMode === 'rappi') {
    deliveryDetail = `<div class="delivery-detail">En camino · esperar courier</div>`
  } else if (c.deliveryMode === 'shipping') {
    deliveryDetail = `<div class="delivery-detail">Despacho a regiones · embalar bien</div>`
  }

  const deliveryHtml = `
<div class="delivery-block">
  <div class="delivery-mode">${deliveryLabel(c.deliveryMode)}</div>
  ${deliveryDetail}
</div>`

  // ─── Nota general ─────────────────────────────────────────────────────────
  const noteHtml = c.notes ? `
<div class="order-note-block">
  <div class="order-note-label">Nota del pedido</div>
  <div class="order-note-text">${escHtml(c.notes)}</div>
</div>` : ''

  // ─── Footer ───────────────────────────────────────────────────────────────
  const footerParts: string[] = [time]
  if (c.cashierName) footerParts.push(escHtml(c.cashierName))

  const body = `
<div class="comanda-header">
  <div>
    <div class="brand-mini">Seoul Kims</div>
    <div style="font-size:9px;color:${INK[300]};margin-top:2px;">서울킴스 · Comanda</div>
  </div>
  <div class="channel-pill">
    <div>${channel}</div>
    <div style="margin-top:2px;font-size:10px;font-weight:700;color:${INK[500]};">${time}</div>
  </div>
</div>

<div class="order-number-block">
  <div class="order-number-label">Pedido N°</div>
  <div class="order-number-value">${String(c.number).padStart(4, '0')}</div>
</div>

<div style="margin-bottom:4px;">
  ${itemsHtml}
</div>

${deliveryHtml}
${noteHtml}

<div class="comanda-footer">
  <span>${footerParts.join(' · ')}</span>
  <span>SEULKIMS.CL</span>
</div>
`

  return htmlShell(
    `Comanda #${c.number} · Seoul Kims`,
    body,
    COMANDA_CSS,
  )
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
