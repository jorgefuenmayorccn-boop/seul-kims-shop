// Wrapper de node-thermal-printer
// Soporta: Epson TM-series, Bixolon SRP-350, Star TSP143

const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer')

const TYPE_MAP = {
  EPSON:  PrinterTypes.EPSON,
  STAR:   PrinterTypes.STAR,
  BIXOLON: PrinterTypes.EPSON,  // Bixolon es compatible ESC/POS
}

function makePrinter(config) {
  return new ThermalPrinter({
    type:        TYPE_MAP[config.printerType] ?? PrinterTypes.EPSON,
    interface:   config.interface === 'usb' ? 'usb' : config.interface,
    width:       config.width ?? 42,
    characterSet: CharacterSet.PC858_EURO,
    breakLine:   BreakLine.WORD,
    options:     config.options ?? { timeout: 5000 },
  })
}

const METHOD_LABEL = {
  cash:   'EFECTIVO',
  debit:  'DEBITO',
  credit: 'CREDITO',
  qr:     'TRANSFERENCIA',
  baes:   'BAES JUNAEB',
}

const DOC_HEADER = {
  nota_venta: 'NOTA DE VENTA',
  boleta:     'BOLETA ELECTRONICA',
  factura:    'FACTURA ELECTRONICA',
}

async function getStatus(config) {
  try {
    const p = makePrinter(config)
    const isConnected = await p.isPrinterConnected()
    return { ready: isConnected, name: `${config.printerType} (${config.interface})` }
  } catch {
    return { ready: false, name: 'No disponible' }
  }
}

async function printTicket(payload, config) {
  const p = makePrinter(config)
  const isConnected = await p.isPrinterConnected()
  if (!isConnected) throw new Error('Impresora no conectada o sin papel')

  const date = new Date(payload.date)
  const dateStr = date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  // Encabezado tienda
  const store = payload.storeInfo
  p.alignCenter()
  p.bold(true)
  p.println(store.name)
  p.bold(false)
  p.println(store.giro)
  p.println(store.address)
  p.println(`RUT ${store.rut}`)
  p.println(store.phone)
  p.drawLine()

  // Tipo de documento
  p.bold(true)
  p.println(DOC_HEADER[payload.ticketType] ?? 'COMPROBANTE')
  p.bold(false)
  if (payload.ticketType === 'nota_venta') {
    p.println('(No es documento tributario)')
  }
  if (payload.folio) {
    p.bold(true)
    p.println(`N° FOLIO: ${payload.folio}`)
    p.bold(false)
  }
  p.drawLine()

  // Número y fecha
  p.alignLeft()
  const numStr = `N° ${String(payload.number).padStart(6, '0')}`
  p.leftRight(numStr, dateStr)
  if (payload.cashier) p.println(`Cajera: ${payload.cashier}`)
  p.drawLine()

  // Receptor (solo factura)
  if (payload.ticketType === 'factura' && payload.receiver) {
    const r = payload.receiver
    p.println(`RUT: ${r.rut}`)
    p.println(r.razonSocial.slice(0, 42))
    p.println(`Giro: ${r.giro.slice(0, 36)}`)
    p.println(`Dir: ${r.direccion.slice(0, 37)}`)
    p.println(r.comuna)
    p.drawLine()
  }

  // Items
  p.leftRight('PRODUCTO', 'TOTAL')
  p.drawLine()

  for (const item of payload.items) {
    const precio = '$' + item.subtotal.toLocaleString('es-CL')
    const qty    = String(item.qty)
    const maxName = 42 - qty.length - 4 - precio.length
    const name   = item.name.slice(0, Math.max(8, maxName))
    p.leftRight(`${qty}x ${name}`, precio)
    if (item.qty !== 1) {
      p.println(`   c/u $${item.unitPrice.toLocaleString('es-CL')}`)
    }
    if (item.isBaes) p.println('   [BAES JUNAEB]')
    if (item.sellos?.length) p.println(`   [${item.sellos.slice(0, 3).join('][')}]`)
  }

  p.drawLine()

  // Totales
  if (payload.baesAmount > 0) {
    p.leftRight('SUBTOTAL', '$' + payload.subtotal.toLocaleString('es-CL'))
    p.leftRight('DESC BAES JUNAEB', `-$${payload.baesAmount.toLocaleString('es-CL')}`)
    p.drawLine()
  }

  if (payload.ticketType === 'factura') {
    const neto = Math.round(payload.total / 1.19)
    const iva  = payload.total - neto
    p.leftRight('NETO', '$' + neto.toLocaleString('es-CL'))
    p.leftRight('IVA 19%', '$' + iva.toLocaleString('es-CL'))
    p.drawLine()
  }

  p.bold(true)
  p.setTextSize(1, 1)
  p.leftRight('TOTAL', '$' + payload.total.toLocaleString('es-CL'))
  p.setTextNormal()
  p.bold(false)
  p.drawLine()

  // Pagos
  for (const pmt of payload.payments) {
    const label = METHOD_LABEL[pmt.method] ?? pmt.label ?? pmt.method.toUpperCase()
    p.leftRight(label, '$' + pmt.amount.toLocaleString('es-CL'))
  }
  if (payload.cashReceived && payload.cashReceived > 0) {
    p.leftRight('Recibido', '$' + payload.cashReceived.toLocaleString('es-CL'))
    if (payload.change && payload.change > 0) {
      p.bold(true)
      p.leftRight('VUELTO', '$' + payload.change.toLocaleString('es-CL'))
      p.bold(false)
    }
  }

  p.drawLine()

  if (payload.ticketType === 'nota_venta') {
    p.alignCenter()
    p.println('Boleta electronica: pendiente')
    p.drawLine()
  }

  // Pie
  p.alignCenter()
  p.println('')
  p.setTextSize(1, 1)
  p.println('Kam-sa-ham-ni-da / Gracias')
  p.setTextNormal()
  p.println('Vuelva pronto / 또 오세요')
  p.println('')
  p.println(`${store.ig}  ·  ${store.web}`)

  if (payload.ticketType === 'nota_venta') {
    p.println('')
    p.println('* Documento sin valor tributario *')
  }

  if (payload.isReprint) {
    p.drawLine()
    p.println(`*** COPIA — ${new Date().toLocaleString('es-CL')} ***`)
  }

  // 3 líneas + corte
  p.println('')
  p.println('')
  p.println('')
  p.cut()

  await p.execute()
  console.log(`[PRINTED] N° ${payload.number} (${payload.ticketType}) — ${new Date().toISOString()}`)
}

async function openDrawer(config) {
  const p = makePrinter(config)
  p.openCashDrawer()
  await p.execute()
}

module.exports = { getStatus, printTicket, openDrawer }
