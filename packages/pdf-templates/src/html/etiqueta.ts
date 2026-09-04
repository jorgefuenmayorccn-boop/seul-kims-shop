// Etiqueta de caja — para pegar en la caja/bolsa antes de despachar o
// entregar en mostrador (adición post-entrega, rediseño B2B, 2-sep-2026).
// Máxima legibilidad a distancia de brazo: N° de pedido dominante, destino
// (dirección o retiro en tienda/Metro) y quién recibe si aplica.

import {
  htmlShell,
  channelLabel, deliveryLabel,
  INK,
} from './design-system'
import type { EtiquetaPayload } from '../ticket-payload'

const ETIQUETA_CSS = `
body { background: ${INK.paper}; }

.etiqueta-header {
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
}

.order-number-block {
  text-align: center;
  padding: 12px 0 10px;
  border-top: 3px solid ${INK[900]};
  border-bottom: 3px solid ${INK[900]};
  margin: 4px 0 12px;
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
  font-size: 56px;
  font-weight: 900;
  color: ${INK[900]};
  line-height: 1.0;
  letter-spacing: -0.02em;
}

.company-block {
  text-align: center;
  font-size: 15px;
  font-weight: 800;
  color: ${INK[900]};
  margin-bottom: 10px;
}

.destino-block {
  border: 2px solid ${INK[900]};
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
}
.destino-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: ${INK[300]};
  text-transform: uppercase;
  margin-bottom: 4px;
}
.destino-value {
  font-size: 15px;
  font-weight: 800;
  color: ${INK[900]};
  line-height: 1.3;
}
.destino-sub {
  font-size: 11px;
  color: ${INK[500]};
  margin-top: 2px;
}

.recipient-block {
  font-size: 12px;
  color: ${INK[700]};
  margin-bottom: 6px;
}
.recipient-label {
  font-weight: 700;
  color: ${INK[300]};
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-right: 4px;
}

.etiqueta-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px solid ${INK[100]};
  font-size: 9px;
  color: ${INK[300]};
}
`

export function renderEtiquetaHtml(e: EtiquetaPayload): string {
  const channel = channelLabel(e.channel)

  let destinoValue = deliveryLabel(e.deliveryMode)
  let destinoSub = ''
  if (e.deliveryMode === 'metro' && e.metroStation) {
    destinoValue = `Estación ${escHtml(e.metroStation)}`
    const subParts = [e.deliveryDate ? formatEtiquetaDate(e.deliveryDate) : null, e.metroSlot].filter(Boolean)
    destinoSub = escHtml(subParts.join(' · '))
  } else if (e.deliveryMode === 'pickup') {
    destinoValue = 'Retiro en tienda'
  } else if (e.deliveryAddress) {
    destinoValue = escHtml(e.deliveryAddress)
  }

  const companyHtml = e.companyName ? `<div class="company-block">${escHtml(e.companyName)}</div>` : ''
  const recipientHtml = e.recipient
    ? `<div class="recipient-block"><span class="recipient-label">Recibe</span>${escHtml(e.recipient)}</div>`
    : ''

  const body = `
<div class="etiqueta-header">
  <div class="brand-mini">Seoul Shop</div>
  <div class="channel-pill">${channel}</div>
</div>

<div class="order-number-block">
  <div class="order-number-label">Pedido N°</div>
  <div class="order-number-value">${String(e.number).padStart(4, '0')}</div>
</div>

${companyHtml}
${recipientHtml}

<div class="destino-block">
  <div class="destino-label">Destino</div>
  <div class="destino-value">${destinoValue}</div>
  ${destinoSub ? `<div class="destino-sub">${destinoSub}</div>` : ''}
</div>

<div class="etiqueta-footer">
  <span>${e.itemCount} ítem${e.itemCount === 1 ? '' : 's'}</span>
  <span>SEULKIMS.CL</span>
</div>
`

  return htmlShell(
    `Etiqueta #${e.number} · Seoul Shop`,
    body,
    ETIQUETA_CSS,
  )
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// yyyy-mm-dd → "Vie 05/09" (adición post-entrega, 3-sep-2026)
function formatEtiquetaDate(isoDate: string): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d.getTime())) return isoDate
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
