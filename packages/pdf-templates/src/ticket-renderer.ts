import { THERMAL_80MM, STORE_INFO } from './constants'
import type { TicketPayload } from './ticket-payload'

const W = THERMAL_80MM.CHARS_PER_LINE

function line(char = '-')   { return char.repeat(W) }
function center(t: string)  { const p = Math.max(0, Math.floor((W - t.length) / 2)); return ' '.repeat(p) + t }
function lr(l: string, r: string) {
  const gap = W - l.length - r.length
  return l + ' '.repeat(Math.max(1, gap)) + r
}
function clp(n: number) { return '$' + n.toLocaleString('es-CL') }

const METHOD_LABEL: Record<string, string> = {
  cash:   'EFECTIVO',
  debit:  'DEBITO',
  credit: 'CREDITO',
  qr:     'TRANSFERENCIA',
  baes:   'BAES JUNAEB',
}

const DOC_HEADER: Record<string, string> = {
  nota_venta: 'NOTA DE VENTA',
  boleta:     'BOLETA ELECTRONICA',
  factura:    'FACTURA ELECTRONICA',
}

const DOC_SUBHEADER: Record<string, string | undefined> = {
  nota_venta: '(No es documento tributario)',
  boleta:     undefined,
  factura:    undefined,
}

export function renderTicketLines(p: TicketPayload): string[] {
  const ls: string[] = []
  const store = p.storeInfo ?? STORE_INFO
  const date  = new Date(p.date)
  const dateStr = date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  // Encabezado tienda
  ls.push(center(store.name))
  ls.push(center(store.giro))
  ls.push(center(store.address))
  ls.push(center(`RUT ${store.rut}`))
  ls.push(center(store.phone))
  ls.push(line('='))

  // Tipo de documento
  ls.push(center(DOC_HEADER[p.ticketType] ?? 'COMPROBANTE'))
  const sub = DOC_SUBHEADER[p.ticketType]
  if (sub) ls.push(center(sub))

  // Folio SII
  if (p.folio) {
    ls.push(center(`N° FOLIO: ${p.folio}`))
  }

  ls.push(line('='))

  // Datos cabecera
  const numStr = `N° ${String(p.number).padStart(6, '0')}`
  ls.push(lr(numStr, dateStr))
  if (p.cashier) ls.push(`Cajera: ${p.cashier}`)
  ls.push(line('-'))

  // Datos receptor (solo factura)
  if (p.ticketType === 'factura' && p.receiver) {
    ls.push(`RUT: ${p.receiver.rut}`)
    ls.push(`${p.receiver.razonSocial.slice(0, W)}`)
    ls.push(`Giro: ${p.receiver.giro.slice(0, W - 6)}`)
    ls.push(`Dir: ${p.receiver.direccion.slice(0, W - 5)}`)
    ls.push(`${p.receiver.comuna}`)
    ls.push(line('-'))
  }

  // Items
  ls.push(lr('PRODUCTO', 'TOTAL'))
  ls.push(line('-'))

  for (const item of p.items) {
    const qty      = String(item.qty)
    const maxName  = W - qty.length - 4 - clp(item.subtotal).length
    const name     = item.name.slice(0, Math.max(8, maxName))
    ls.push(lr(`${qty}x ${name}`, clp(item.subtotal)))
    if (item.qty !== 1) {
      ls.push(`   c/u ${clp(item.unitPrice)}`)
    }
    if (item.isBaes) ls.push('   [BAES JUNAEB]')
    if (item.sellos?.length) ls.push(`   [${item.sellos.slice(0, 3).join('][')}]`)
  }

  ls.push(line('-'))

  // Totales
  if (p.baesAmount > 0) {
    ls.push(lr('SUBTOTAL', clp(p.subtotal)))
    ls.push(lr('DESC BAES JUNAEB', `-${clp(p.baesAmount)}`))
    ls.push(line('-'))
  }

  // IVA (solo factura)
  if (p.ticketType === 'factura') {
    const neto = Math.round(p.total / 1.19)
    const iva  = p.total - neto
    ls.push(lr('NETO', clp(neto)))
    ls.push(lr('IVA 19%', clp(iva)))
    ls.push(line('-'))
  }

  ls.push(lr('TOTAL', clp(p.total)))
  ls.push(line('='))

  // Pagos
  for (const pmt of p.payments) {
    const label = METHOD_LABEL[pmt.method] ?? pmt.label ?? pmt.method.toUpperCase()
    ls.push(lr(label, clp(pmt.amount)))
  }
  if (p.cashReceived && p.cashReceived > 0) {
    ls.push(lr('Recibido', clp(p.cashReceived)))
    if (p.change && p.change > 0) {
      ls.push(lr('VUELTO', clp(p.change)))
    }
  }

  ls.push(line('='))

  // DTE pendiente (solo nota_venta)
  if (p.ticketType === 'nota_venta') {
    ls.push(center('Boleta electronica: pendiente'))
    ls.push(line('-'))
  }

  // Pie
  ls.push('')
  ls.push(center('감사합니다'))
  ls.push(center('Gracias por su compra'))
  ls.push(center('또 오세요 — Vuelva pronto'))
  ls.push('')
  ls.push(center(`${store.ig}  ·  ${store.web}`))

  if (p.ticketType === 'nota_venta') {
    ls.push('')
    ls.push(center('* Documento sin valor tributario *'))
  }

  if (p.isReprint) {
    ls.push(line('-'))
    ls.push(center(`*** COPIA — ${new Date().toLocaleString('es-CL')} ***`))
  }

  ls.push(line('='))
  ls.push('')
  ls.push('')
  ls.push('')  // líneas en blanco antes del corte

  return ls
}
