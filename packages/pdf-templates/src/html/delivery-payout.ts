// Liquidación de repartidor — comprobante interno de pago de turno

import { htmlShell, INK } from './design-system'

export interface DeliveryPayoutData {
  driverName:       string
  periodStart:      string   // ISO
  periodEnd:        string   // ISO
  assignments:      number
  distanciaKmTotal: number
  tarifaKmClp:      number   // typically 1000
  grossClp:         number
  cashCollected:    number
  netPayable:       number   // positive = pay driver, negative = driver owes
  issuedAt?:        string   // ISO
}

const CSS = `
body { background: ${INK.paper}; }
.payout-header {
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 2px solid ${INK[900]};
  margin-bottom: 12px;
}
.brand {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: ${INK[900]};
  text-transform: uppercase;
}
.doc-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: ${INK[500]};
  text-transform: uppercase;
  margin-top: 4px;
}
.driver-name {
  font-size: 13px;
  font-weight: 700;
  color: ${INK[900]};
  margin: 10px 0 2px;
  text-align: center;
}
.period {
  font-size: 9px;
  color: ${INK[300]};
  text-align: center;
  margin-bottom: 12px;
}
.sep {
  border: none;
  border-top: 1px dashed ${INK[700]};
  margin: 8px 0;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}
.row-label { font-size: 9px; color: ${INK[300]}; }
.row-value { font-size: 9px; font-weight: 600; color: ${INK[700]}; }
.net-block {
  margin-top: 10px;
  padding: 8px;
  border: 2px solid ${INK[900]};
  border-radius: 4px;
  text-align: center;
}
.net-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: ${INK[500]};
  text-transform: uppercase;
}
.net-amount {
  font-size: 20px;
  font-weight: 900;
  color: ${INK[900]};
  margin-top: 2px;
}
.net-direction {
  font-size: 8px;
  color: ${INK[300]};
  margin-top: 2px;
}
.footer {
  margin-top: 14px;
  text-align: center;
  font-size: 8px;
  color: ${INK[300]};
  border-top: 1px dashed ${INK[700]};
  padding-top: 8px;
}
`

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function clp(n: number) {
  return '$' + Math.abs(n).toLocaleString('es-CL')
}

export function renderDeliveryPayoutHtml(data: DeliveryPayoutData): string {
  const body = `
    <div class="payout-header">
      <div class="brand">Seoul Shop</div>
      <div class="doc-title">Liquidación de Turno</div>
    </div>

    <div class="driver-name">${data.driverName}</div>
    <div class="period">
      ${fmt(data.periodStart)} — ${fmt(data.periodEnd)}
    </div>

    <div class="row">
      <span class="row-label">Entregas completadas</span>
      <span class="row-value">${data.assignments}</span>
    </div>
    <div class="row">
      <span class="row-label">Distancia total</span>
      <span class="row-value">${Number(data.distanciaKmTotal).toFixed(1)} km</span>
    </div>
    <div class="row">
      <span class="row-label">Tarifa por km</span>
      <span class="row-value">${clp(data.tarifaKmClp)}</span>
    </div>

    <hr class="sep" />

    <div class="row">
      <span class="row-label">Ganancia bruta</span>
      <span class="row-value">${clp(data.grossClp)}</span>
    </div>
    <div class="row">
      <span class="row-label">Efectivo recibido (descuento)</span>
      <span class="row-value">− ${clp(data.cashCollected)}</span>
    </div>

    <div class="net-block">
      <div class="net-label">
        ${data.netPayable >= 0 ? 'A pagar al repartidor' : 'Repartidor debe reintegrar'}
      </div>
      <div class="net-amount">${clp(data.netPayable)}</div>
      <div class="net-direction">
        ${data.netPayable >= 0
          ? 'La tienda paga esta diferencia al repartidor'
          : 'El repartidor recaudó más que su ganancia'}
      </div>
    </div>

    <div class="footer">
      Emitido: ${fmt(data.issuedAt ?? new Date().toISOString())}<br/>
      Documento interno — Seoul Shop @seoulshopcl
    </div>
  `
  return htmlShell(`Liquidación — ${data.driverName}`, body, CSS)
}
