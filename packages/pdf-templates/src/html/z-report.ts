// Z-Reports — Till (Cierre Caja) + Master (Cierre Turno)
// Datos densos organizados con jerarquía clara en 72mm

import {
  htmlShell, storeHeader, storeFooter,
  clp, formatDateTime, formatTime, padNum,
  metodoPagoLabel, INK,
} from './design-system'
// Tipos duplicados aquí para mantener pdf-templates sin dependencia de @seul/db
export interface TillZReport {
  tillId:            string
  tillSessionNumber: number
  shiftId:           string
  shiftNumber:       number
  cashierName:       string
  openedAt:          string
  closedAt:          string
  openingFloat:      number
  ticketCount:       number
  voidCount:         number
  refundCount:       number
  grossTotal:        number
  refundTotal:       number
  netTotal:          number
  byMethod:          Record<string, number>
  expectedCash:      number
}

export interface MasterZReport {
  shiftId:      string
  shiftNumber:  number
  openedAt:     string
  closedAt:     string
  tillCount:    number
  totalTickets: number
  totalVoids:   number
  totalRefunds: number
  grossTotal:   number
  refundTotal:  number
  netTotal:     number
  byMethod:     Record<string, number>
  tills: Array<{
    tillId:            string
    tillSessionNumber: number
    cashierName:       string
    openedAt:          string
    closedAt:          string | null
    openingFloat:      number
    ticketCount:       number
    netTotal:          number
    byMethod:          Record<string, number>
  }>
}

const ZREPORT_CSS = `
.report-title {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${INK[900]};
  text-align: center;
}
.session-block {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 8px 0;
}
.session-id {
  font-size: 15px;
  font-weight: 900;
  color: ${INK[900]};
  letter-spacing: 0.04em;
}
.time-range {
  text-align: right;
  font-size: 9px;
  color: ${INK[300]};
  line-height: 1.6;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}
.stat-label { font-size: 10px; color: ${INK[500]}; }
.stat-value { font-size: 10px; color: ${INK[700]}; font-weight: 500; }
.stat-value.emphasis { font-size: 11px; color: ${INK[900]}; font-weight: 900; }

.method-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}
.method-label { font-size: 10px; color: ${INK[500]}; }
.method-value { font-size: 10px; color: ${INK[700]}; font-weight: 500; }

.total-block {
  border-top: 1px solid ${INK[100]};
  padding-top: 6px;
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.total-block .label { font-size: 10px; font-weight: 700; color: ${INK[900]}; letter-spacing: 0.06em; text-transform: uppercase; }
.total-block .value { font-size: 14px; font-weight: 900; color: ${INK[900]}; }

.float-block {
  background: #f7f7f7;
  border-left: 2px solid ${INK[100]};
  padding: 6px 8px;
  margin: 6px 0;
}
.float-block .float-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}
.float-row .lbl { font-size: 9px; color: ${INK[500]}; }
.float-row .val { font-size: 9px; color: ${INK[700]}; font-weight: 500; }
.float-row.expected .lbl { font-size: 10px; font-weight: 700; color: ${INK[900]}; }
.float-row.expected .val { font-size: 12px; font-weight: 900; color: ${INK[900]}; }

.till-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px dashed ${INK[100]};
}
.till-summary-row:last-child { border-bottom: none; }
.till-id  { font-size: 9px; font-weight: 700; color: ${INK[700]}; }
.till-cashier { font-size: 9px; color: ${INK[300]}; }
.till-net { font-size: 9px; font-weight: 700; color: ${INK[700]}; }

.signature-line {
  margin-top: 12px;
  border-top: 1px solid ${INK[700]};
  padding-top: 4px;
  font-size: 9px;
  color: ${INK[300]};
  text-align: center;
  letter-spacing: 0.06em;
}
`

// ─── Till Z-Report ────────────────────────────────────────────────────────────

export function renderTillZReportHtml(r: TillZReport): string {
  const activeMethods = (Object.entries(r.byMethod) as [string, number][])
    .filter(([, v]) => v > 0)

  const methodsHtml = activeMethods.map(([method, amount]) => `
<div class="method-row">
  <span class="method-label">${metodoPagoLabel(method)}</span>
  <span class="method-value">${clp(amount)}</span>
</div>`).join('')

  const body = `
${storeHeader()}

<hr class="sep">

<div class="report-title mb-2">Cierre de Caja</div>

<div class="session-block">
  <div>
    <div class="session-id">Caja #${r.tillSessionNumber}</div>
    <div class="meta mt-1">Turno #${r.shiftNumber}</div>
    <div class="meta mt-1">${escHtml(r.cashierName)}</div>
  </div>
  <div class="time-range">
    <div>${formatTime(r.openedAt)} apertura</div>
    <div>${formatTime(r.closedAt)} cierre</div>
    <div class="mt-1">${new Date(r.closedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
  </div>
</div>

<hr class="sep">

<div class="section-lbl mb-2">Ventas</div>

<div class="stat-row">
  <span class="stat-label">Tickets emitidos</span>
  <span class="stat-value">${r.ticketCount}</span>
</div>
${r.voidCount > 0 ? `
<div class="stat-row">
  <span class="stat-label">Anulaciones</span>
  <span class="stat-value">${r.voidCount}</span>
</div>` : ''}
${r.refundCount > 0 ? `
<div class="stat-row">
  <span class="stat-label">Devoluciones</span>
  <span class="stat-value">${r.refundCount}</span>
</div>` : ''}

<hr class="sep-light">

<div class="stat-row mt-1">
  <span class="stat-label">Venta bruta</span>
  <span class="stat-value">${clp(r.grossTotal)}</span>
</div>
${r.refundTotal > 0 ? `
<div class="stat-row">
  <span class="stat-label">(−) Devoluciones</span>
  <span class="stat-value">−${clp(r.refundTotal)}</span>
</div>` : ''}

<div class="total-block">
  <span class="label">Venta Neta</span>
  <span class="value">${clp(r.netTotal)}</span>
</div>

<hr class="sep">

<div class="section-lbl mb-2">Desglose por método</div>
${methodsHtml || '<div class="meta">Sin movimientos registrados</div>'}

<hr class="sep">

<div class="section-lbl mb-2">Cuadre de efectivo</div>

<div class="float-block">
  <div class="float-row">
    <span class="lbl">Fondo inicial</span>
    <span class="val">${clp(r.openingFloat)}</span>
  </div>
  <div class="float-row">
    <span class="lbl">(+) Ventas efectivo</span>
    <span class="val">${clp(r.byMethod.cash ?? 0)}</span>
  </div>
  <div class="float-row expected mt-1">
    <span class="lbl">Esperado en caja</span>
    <span class="val">${clp(r.expectedCash)}</span>
  </div>
</div>

<div class="signature-line">FIRMA CAJERA ________________________</div>

${storeFooter()}
`

  return htmlShell(
    `Z-Report Caja #${r.tillSessionNumber} · Turno #${r.shiftNumber}`,
    body,
    ZREPORT_CSS,
  )
}

// ─── Master Shift Z-Report ───────────────────────────────────────────────────

export function renderMasterZReportHtml(r: MasterZReport): string {
  const activeMethods = (Object.entries(r.byMethod) as [string, number][])
    .filter(([, v]) => v > 0)

  const methodsHtml = activeMethods.map(([method, amount]) => `
<div class="method-row">
  <span class="method-label">${metodoPagoLabel(method)}</span>
  <span class="method-value">${clp(amount)}</span>
</div>`).join('')

  const tillsHtml = r.tills.map(t => `
<div class="till-summary-row">
  <div>
    <span class="till-id">Caja #${t.tillSessionNumber}</span>
    ${t.cashierName ? `<span class="till-cashier"> · ${escHtml(t.cashierName)}</span>` : ''}
  </div>
  <span class="till-net">${clp(t.netTotal)}</span>
</div>`).join('')

  const body = `
${storeHeader()}

<hr class="sep">

<div class="report-title mb-2">Cierre de Turno (Maestro)</div>

<div class="session-block">
  <div>
    <div class="session-id">Turno #${r.shiftNumber}</div>
    <div class="meta mt-1">${r.tillCount} caja${r.tillCount !== 1 ? 's' : ''}</div>
  </div>
  <div class="time-range">
    <div>${formatTime(r.openedAt)} apertura</div>
    <div>${formatTime(r.closedAt)} cierre</div>
    <div class="mt-1">${new Date(r.closedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
  </div>
</div>

${r.tills.length > 0 ? `
<hr class="sep">
<div class="section-lbl mb-2">Resumen por caja</div>
${tillsHtml}` : ''}

<hr class="sep">

<div class="section-lbl mb-2">Totales consolidados</div>

<div class="stat-row">
  <span class="stat-label">Tickets totales</span>
  <span class="stat-value">${r.totalTickets}</span>
</div>
${r.totalVoids > 0 ? `
<div class="stat-row">
  <span class="stat-label">Anulaciones</span>
  <span class="stat-value">${r.totalVoids}</span>
</div>` : ''}
${r.totalRefunds > 0 ? `
<div class="stat-row">
  <span class="stat-label">Devoluciones</span>
  <span class="stat-value">${r.totalRefunds}</span>
</div>` : ''}

<hr class="sep-light">

<div class="stat-row mt-1">
  <span class="stat-label">Venta bruta</span>
  <span class="stat-value">${clp(r.grossTotal)}</span>
</div>
${r.refundTotal > 0 ? `
<div class="stat-row">
  <span class="stat-label">(−) Devoluciones</span>
  <span class="stat-value">−${clp(r.refundTotal)}</span>
</div>` : ''}

<div class="total-block">
  <span class="label">Venta Neta Turno</span>
  <span class="value">${clp(r.netTotal)}</span>
</div>

<hr class="sep">

<div class="section-lbl mb-2">Desglose por método</div>
${methodsHtml || '<div class="meta">Sin movimientos registrados</div>'}

${storeFooter()}
`

  return htmlShell(
    `Z-Report Maestro · Turno #${r.shiftNumber}`,
    body,
    ZREPORT_CSS,
  )
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
