// Nota de Venta — comprobante interno para pruebas
// Reemplazará con Boleta Electrónica SII cuando el DTE esté configurado.
// Mismo formato 80mm que la boleta real para que el cajero no note diferencia.

import { THERMAL_80MM, STORE_INFO } from './constants'

export interface NotaDeVentaData {
  number:      number
  date:        Date
  items: {
    name:      string
    quantity:  number
    unitPrice: number
    isBaes?:   boolean
  }[]
  subtotal:    number
  baesAmount?: number
  total:       number
  payments: {
    method: string
    amount: number
  }[]
  cashReceived?:   number
  change?:         number
  cashierName?:    string
  deliveryAddress?: string
  deliveryFloor?:  string
  deliveryApt?:    string
  deliveryRefs?:   string
  showIva?:        boolean  // mostrar desglose Neto + IVA 19%
}

const LINE = '—'.repeat(THERMAL_80MM.CHARS_PER_LINE)
const LINE_THIN = '-'.repeat(THERMAL_80MM.CHARS_PER_LINE)

function pad(left: string, right: string, width = THERMAL_80MM.CHARS_PER_LINE): string {
  const gap = width - left.length - right.length
  return gap > 0 ? left + ' '.repeat(gap) + right : left.slice(0, width - right.length - 1) + ' ' + right
}

function center(text: string, width = THERMAL_80MM.CHARS_PER_LINE): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

function formatCLP(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

function formatMethod(method: string): string {
  const map: Record<string, string> = {
    cash:   'EFECTIVO',
    debit:  'DEBITO',
    credit: 'CREDITO',
    qr:     'TRANSFERENCIA',
    baes:   'BAES JUNAEB',
  }
  return map[method] ?? method.toUpperCase()
}

export function buildNotaDeVenta(data: NotaDeVentaData): string {
  const lines: string[] = []

  // Encabezado
  lines.push(center(STORE_INFO.name))
  lines.push(center(STORE_INFO.giro))
  lines.push(center(STORE_INFO.address))
  lines.push(center(`RUT: ${STORE_INFO.rut}`))
  lines.push(center(STORE_INFO.web))
  lines.push('')
  lines.push(LINE)
  lines.push(center('*** NOTA DE VENTA ***'))
  lines.push(center('(No es documento tributario)'))
  lines.push(LINE)
  lines.push('')

  // Número y fecha
  const dateStr = data.date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  lines.push(pad(`N° ${data.number.toString().padStart(6, '0')}`, dateStr))
  if (data.cashierName) lines.push(`Cajera: ${data.cashierName}`)

  // Dirección de despacho
  if (data.deliveryAddress) {
    lines.push('')
    lines.push(LINE_THIN)
    lines.push(center('DESPACHO A DOMICILIO'))
    const addr = data.deliveryAddress.slice(0, THERMAL_80MM.CHARS_PER_LINE)
    lines.push(addr)
    if (data.deliveryApt)  lines.push(data.deliveryApt.slice(0, THERMAL_80MM.CHARS_PER_LINE))
    if (data.deliveryFloor) lines.push(data.deliveryFloor.slice(0, THERMAL_80MM.CHARS_PER_LINE))
    if (data.deliveryRefs) lines.push(`Ref: ${data.deliveryRefs}`.slice(0, THERMAL_80MM.CHARS_PER_LINE))
  }

  lines.push('')
  lines.push(LINE_THIN)

  // Items
  for (const item of data.items) {
    const name = item.name.slice(0, 28)
    lines.push(name + (item.isBaes ? ' [BAES]' : ''))
    const qty   = `  ${item.quantity} x ${formatCLP(item.unitPrice)}`
    const total = formatCLP(item.quantity * item.unitPrice)
    lines.push(pad(qty, total))
  }

  lines.push(LINE_THIN)
  lines.push('')

  // Totales
  if (data.baesAmount && data.baesAmount > 0) {
    lines.push(pad('Subtotal:', formatCLP(data.subtotal)))
    lines.push(pad('Subsidio BAES:', `- ${formatCLP(data.baesAmount)}`))
    lines.push(LINE_THIN)
  }

  if (data.showIva) {
    const neto = Math.round(data.total / 1.19)
    const iva  = data.total - neto
    lines.push(pad('Neto:', formatCLP(neto)))
    lines.push(pad('IVA 19%:', formatCLP(iva)))
    lines.push(LINE_THIN)
  }

  lines.push(pad('TOTAL:', formatCLP(data.total)))
  lines.push('')

  // Pagos
  for (const p of data.payments) {
    lines.push(pad(formatMethod(p.method) + ':', formatCLP(p.amount)))
  }

  if (data.cashReceived && data.cashReceived > 0) {
    lines.push(pad('Recibido:', formatCLP(data.cashReceived)))
    if (data.change && data.change > 0) {
      lines.push(pad('VUELTO:', formatCLP(data.change)))
    }
  }

  lines.push('')
  lines.push(LINE)

  // Pie
  lines.push('')
  lines.push(center('감사합니다'))
  lines.push(center('Gracias por su compra'))
  lines.push(center('又 오세요 — Vuelva pronto'))
  lines.push('')
  lines.push(center(STORE_INFO.ig))
  lines.push('')
  lines.push(center('* Documento sin valor tributario *'))
  lines.push(center('Boleta electronica disponible pronto'))
  lines.push('')
  lines.push('')

  return lines.join('\n')
}
