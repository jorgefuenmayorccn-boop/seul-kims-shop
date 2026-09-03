// Design system compartido para todos los templates HTML de impresión térmica 80mm
// Estética: quiet luxury POS — minimalista, tipografía monospace con jerarquía clara

import { STORE_INFO } from '../constants'

// ─── Paleta ──────────────────────────────────────────────────────────────────

export const INK = {
  900: '#0a0a0a',  // Brand name, totales, números de orden
  700: '#1a1a1a',  // Items principales, texto base
  500: '#4a4a4a',  // Precios unitarios, metadata secundaria
  300: '#8a8a8a',  // Labels, footers, información de contexto
  100: '#d4d4d4',  // Separadores, bordes
  paper: '#ffffff',
} as const

// ─── CSS base ────────────────────────────────────────────────────────────────

export const BASE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: ${INK[700]};
  background: ${INK.paper};
  -webkit-font-smoothing: antialiased;
}

.ticket {
  width: 72mm;
  margin: 0 auto;
  padding: 5mm 0 8mm;
}

/* Tipografía */
.brand       { font-size: 13px; font-weight: 900; letter-spacing: 0.22em; color: ${INK[900]}; text-transform: uppercase; }
.brand-sub   { font-size: 9px;  font-weight: 400; letter-spacing: 0.08em; color: ${INK[300]}; }
.doc-type    { font-size: 9px;  font-weight: 400; letter-spacing: 0.18em; color: ${INK[500]}; text-transform: uppercase; }
.anchor-num  { font-size: 22px; font-weight: 900; letter-spacing: 0.02em; color: ${INK[900]}; line-height: 1.1; }
.anchor-lg   { font-size: 26px; font-weight: 900; letter-spacing: 0; color: ${INK[900]}; line-height: 1.0; }
.section-lbl { font-size: 9px;  font-weight: 700; letter-spacing: 0.14em; color: ${INK[300]}; text-transform: uppercase; }
.meta        { font-size: 9px;  font-weight: 400; letter-spacing: 0.04em; color: ${INK[300]}; }
.meta-strong { font-size: 9px;  font-weight: 700; color: ${INK[500]}; }
.item-name   { font-size: 11px; font-weight: 400; color: ${INK[700]}; }
.item-qty    { font-size: 11px; font-weight: 700; color: ${INK[900]}; }
.item-price  { font-size: 11px; font-weight: 400; color: ${INK[700]}; }
.unit-price  { font-size: 9px;  font-weight: 400; color: ${INK[300]}; }
.total-label { font-size: 11px; font-weight: 700; color: ${INK[900]}; }
.total-value { font-size: 13px; font-weight: 900; color: ${INK[900]}; }
.sello       { font-size: 8px;  font-weight: 400; color: ${INK[300]}; text-transform: uppercase; letter-spacing: 0.06em; }
.baes-badge  { font-size: 8px;  font-weight: 700; color: ${INK[500]}; letter-spacing: 0.06em; }
.dte-badge   { font-size: 9px;  font-weight: 400; color: ${INK[300]}; font-style: italic; }

/* Layout helpers */
.center    { text-align: center; }
.right     { text-align: right; }
.row       { display: flex; justify-content: space-between; align-items: baseline; }
.row-top   { display: flex; justify-content: space-between; align-items: flex-start; }
.col       { display: flex; flex-direction: column; }
.indent    { padding-left: 12px; }
.indent-2  { padding-left: 20px; }
.mt-1      { margin-top: 3px; }
.mt-2      { margin-top: 6px; }
.mt-3      { margin-top: 10px; }
.mt-4      { margin-top: 14px; }
.mb-1      { margin-bottom: 3px; }
.mb-2      { margin-bottom: 6px; }
.mb-3      { margin-bottom: 10px; }
.mb-4      { margin-bottom: 14px; }
.pt-2      { padding-top: 6px; }
.pb-2      { padding-bottom: 6px; }
.block     { display: block; }

/* Separadores */
.sep {
  border: none;
  border-top: 1px solid ${INK[100]};
  margin: 8px 0;
}
.sep-light {
  border: none;
  border-top: 1px dashed ${INK[100]};
  margin: 6px 0;
}

/* Print */
@media print {
  @page { size: 80mm auto; margin: 0; }
  body  { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none; }
}
@media screen {
  body { background: #f2f2f2; }
  .ticket { margin: 10mm auto; background: #fff; padding: 8mm; box-shadow: 0 2px 16px rgba(0,0,0,0.12); border-radius: 2px; }
}
`

// ─── Helpers de formato ──────────────────────────────────────────────────────

export function clp(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function padNum(n: number, digits = 6): string {
  return String(n).padStart(digits, '0')
}

// ─── Shell HTML ──────────────────────────────────────────────────────────────

export function htmlShell(title: string, body: string, extraCss = ''): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${BASE_CSS}
${extraCss}
</style>
</head>
<body>
<div class="ticket">
${body}
</div>
<script>
if (window.opener || window.name === 'print_popup') {
  window.addEventListener('load', function() {
    setTimeout(function() { window.focus(); window.print(); }, 350);
  });
}
</script>
</body>
</html>`
}

// ─── Store header compartido ─────────────────────────────────────────────────

export function storeHeader(): string {
  return `
<div class="center mb-3">
  <div class="brand">${STORE_INFO.name}</div>
  <div class="brand-sub mt-1">서울킴스</div>
  <div class="meta mt-1">${STORE_INFO.address}</div>
  <div class="meta">RUT ${STORE_INFO.rut} · ${STORE_INFO.giro}</div>
</div>`
}

// ─── Footer compartido ───────────────────────────────────────────────────────

export function storeFooter(): string {
  return `
<div class="center mt-4">
  <div class="meta">감사합니다 · Gracias por su visita</div>
  <div class="meta mt-1">${STORE_INFO.ig} · ${STORE_INFO.web}</div>
</div>`
}

// ─── Canal label ─────────────────────────────────────────────────────────────

export function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    pos:      'CAJA',
    web:      'TIENDA WEB',
    b2b:      'MAYORISTA',
    whatsapp: 'WHATSAPP',
  }
  return labels[channel] ?? channel.toUpperCase()
}

export function deliveryLabel(mode: string): string {
  const labels: Record<string, string> = {
    pickup:   'RETIRO EN TIENDA',
    metro:    'RETIRO MERVAL',
    rappi:    'DELIVERY RAPPI',
    shipping: 'DESPACHO A DOMICILIO',
    delivery: 'DELIVERY A DOMICILIO',
  }
  return labels[mode] ?? mode.toUpperCase()
}

export function metodoPagoLabel(method: string): string {
  const labels: Record<string, string> = {
    cash:     'Efectivo',
    debit:    'Débito',
    credit:   'Crédito',
    baes:     'BAES JUNAEB',
    qr:       'QR / Transferencia',
    transfer: 'Transferencia',
  }
  return labels[method] ?? method
}

export function dteStatusText(status?: string): string {
  if (!status || status === 'issued' || status === 'accepted_sii') return ''
  if (status === 'pending' || status === 'sending')
    return 'Boleta electrónica en proceso de emisión'
  if (status === 'failed' || status === 'rejected_sii')
    return 'Error en emisión de boleta · Contacte al administrador'
  return ''
}
