import PDFDocument from 'pdfkit'
import { THERMAL_80MM, STORE_INFO } from './constants'

export interface BoletaItem {
  name:      string
  quantity:  number | string
  unitPrice: number
  subtotal:  number
  sellos?:   string[]   // 'ALTO EN SODIO', 'ALTO EN GRASAS', etc.
  isBaes?:   boolean
}

export interface BoletaData {
  folio:        string
  fecha:        Date
  channel:      'pos' | 'web' | 'b2b' | 'whatsapp'
  items:        BoletaItem[]
  subtotal:     number
  baesAmount:   number
  total:        number
  deliveryMode?: string
  dteTimbre?:   string   // TED XML timbrado SII
  cajera?:      string
  documentType?: 'nota_venta' | 'boleta' | 'factura'  // default: 'boleta'
}

// --- Helpers de formato a 42 columnas ---

function line(char = '-'): string {
  return char.repeat(THERMAL_80MM.CHARS_PER_LINE)
}

function center(text: string): string {
  const pad = Math.max(0, Math.floor((THERMAL_80MM.CHARS_PER_LINE - text.length) / 2))
  return ' '.repeat(pad) + text
}

function leftRight(left: string, right: string): string {
  const space = THERMAL_80MM.CHARS_PER_LINE - left.length - right.length
  return left + ' '.repeat(Math.max(1, space)) + right
}

function clp(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

const CHANNEL_LABEL: Record<string, string> = {
  pos:       'CAJA',
  web:       'TIENDA WEB',
  b2b:       'MAYORISTA',
  whatsapp:  'WHATSAPP',
}

// --- Renderiza la boleta como array de líneas de texto ---
export function renderBoletaText(data: BoletaData): string[] {
  const { folio, fecha, channel, items, subtotal, baesAmount, total } = data
  const ls: string[] = []

  const docHeader =
    data.documentType === 'nota_venta' ? 'NOTA DE VENTA' :
    data.documentType === 'factura'    ? 'FACTURA ELECTRONICA' :
    'BOLETA ELECTRONICA'

  ls.push(center(STORE_INFO.name))
  ls.push(center(STORE_INFO.address))
  ls.push(center(`RUT ${STORE_INFO.rut}`))
  ls.push(center(STORE_INFO.giro))
  ls.push(center(`TEL ${STORE_INFO.phone}`))
  ls.push(line('='))
  ls.push(center(docHeader))
  if (data.documentType === 'nota_venta') {
    ls.push(center('(No es documento tributario)'))
  }
  ls.push(center(`N° ${folio}`))
  ls.push(center(fecha.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })))
  ls.push(center(`CANAL: ${CHANNEL_LABEL[channel] ?? channel}`))
  if (data.cajera) ls.push(center(`CAJERA: ${data.cajera}`))
  ls.push(line('-'))
  ls.push(leftRight('PRODUCTO', 'TOTAL'))
  ls.push(line('-'))

  for (const item of items) {
    const qty      = typeof item.quantity === 'number' ? String(item.quantity) : item.quantity
    const maxName  = 26 - qty.length
    const nameTrunc = item.name.substring(0, maxName)
    ls.push(leftRight(`${qty}x ${nameTrunc}`, clp(item.subtotal)))
    if (item.unitPrice && item.quantity !== 1) {
      ls.push(`   c/u ${clp(item.unitPrice)}`)
    }
    if (item.sellos?.length) {
      ls.push(`   [${item.sellos.slice(0, 3).join('][')}]`)
    }
    if (item.isBaes) {
      ls.push('   [BAES JUNAEB]')
    }
  }

  ls.push(line('-'))
  ls.push(leftRight('SUBTOTAL', clp(subtotal)))

  if (baesAmount > 0) {
    ls.push(leftRight('DESC BAES JUNAEB', `-${clp(baesAmount)}`))
  }

  if (data.documentType === 'factura') {
    const neto = Math.round(total / 1.19)
    const iva  = total - neto
    ls.push(line('-'))
    ls.push(leftRight('NETO', clp(neto)))
    ls.push(leftRight('IVA (19%)', clp(iva)))
  }

  ls.push(line('='))
  ls.push(leftRight('TOTAL', clp(total)))
  ls.push(line('='))

  if (data.dteTimbre) {
    ls.push('')
    ls.push(center('[TIMBRE SII]'))
    ls.push(center('Documento tributario válido'))
    ls.push(center('Verifique en sii.cl'))
  }

  if (data.deliveryMode) {
    ls.push(line('-'))
    const modeLabel =
      data.deliveryMode === 'metro'    ? 'Retiro Metro Merval' :
      data.deliveryMode === 'rappi'    ? 'Delivery Rappi' :
      data.deliveryMode === 'pickup'   ? 'Retiro en tienda' :
      data.deliveryMode === 'shipping' ? 'Despacho a domicilio' :
      data.deliveryMode
    ls.push(center(`ENTREGA: ${modeLabel}`))
  }

  ls.push(line('-'))
  ls.push(center(`Gracias por comprar en ${STORE_INFO.name}`))
  ls.push(center(`${STORE_INFO.ig}  ·  ${STORE_INFO.web}`))
  ls.push(line('='))
  ls.push('')

  return ls
}

// --- Genera PDFDocument (stream) ---
function buildDoc(data: BoletaData): PDFKit.PDFDocument {
  const textLines = renderBoletaText(data)
  const linesCount = textLines.length
  const docHeight = THERMAL_80MM.MARGIN_PT * 2
    + linesCount * (THERMAL_80MM.FONT_SIZE_PT + 2)
    + 20 // padding bottom

  const doc = new PDFDocument({
    size:    [THERMAL_80MM.WIDTH_PT, Math.max(docHeight, 200)],
    margins: {
      top:    THERMAL_80MM.MARGIN_PT,
      bottom: THERMAL_80MM.MARGIN_PT,
      left:   THERMAL_80MM.MARGIN_PT,
      right:  THERMAL_80MM.MARGIN_PT,
    },
    autoFirstPage: true,
    compress:      false,
  })

  doc.font('Courier').fontSize(THERMAL_80MM.FONT_SIZE_PT)

  for (const lineText of textLines) {
    doc.text(lineText, { lineGap: 2, continued: false })
  }

  doc.end()
  return doc
}

// --- API pública: genera Buffer (Workers-compatible con nodejs_compat) ---
export async function generateBoletaBuffer(data: BoletaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = buildDoc(data)
    const chunks: Buffer[] = []
    doc.on('data',  (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

// Alias para compatibilidad
export { buildDoc as generateBoletaPDF }
