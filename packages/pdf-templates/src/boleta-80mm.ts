import PDFDocument from 'pdfkit'
import { THERMAL_80MM, STORE_INFO } from './constants'

export interface BoletaItem {
  name: string
  quantity: number | string
  unitPrice: number
  subtotal: number
  sellos?: string[]   // 'ALTO EN SODIO' etc
  isBaes?: boolean
}

export interface BoletaData {
  folio: string
  fecha: Date
  items: BoletaItem[]
  subtotal: number
  baesAmount: number
  total: number
  dteTimbre?: string  // XML timbrado SII (para QR)
  cajera?: string
}

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

function formatCLP(n: number): string {
  return `$ ${n.toLocaleString('es-CL')}`
}

export function renderBoletaText(data: BoletaData): string[] {
  const { folio, fecha, items, subtotal, baesAmount, total } = data
  const lines: string[] = []

  lines.push(center(STORE_INFO.name))
  lines.push(center(STORE_INFO.address))
  lines.push(center(`RUT ${STORE_INFO.rut}`))
  lines.push(center(STORE_INFO.giro))
  lines.push(line('='))
  lines.push(center(`BOLETA ELECTRÓNICA N° ${folio}`))
  lines.push(center(fecha.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })))
  lines.push(line('-'))

  for (const item of items) {
    const qty = typeof item.quantity === 'number'
      ? `${item.quantity}`
      : item.quantity
    const nameTrunc = item.name.substring(0, 28)
    lines.push(leftRight(`${qty}  ${nameTrunc}`, formatCLP(item.subtotal)))
    if (item.sellos?.length) {
      lines.push(`   [${item.sellos.join('][')}]`)
    }
    if (item.isBaes) {
      lines.push('   [BAES JUNAEB]')
    }
  }

  lines.push(line('-'))
  lines.push(leftRight('SUBTOTAL', formatCLP(subtotal)))

  if (baesAmount > 0) {
    lines.push(leftRight('BAES aplicado (-)', formatCLP(baesAmount)))
  }

  lines.push(leftRight('TOTAL PAGADO', formatCLP(total)))
  lines.push(line('='))

  if (data.dteTimbre) {
    lines.push(center('[Timbre SII]'))
    lines.push(center('Ver QR para verificar'))
  }

  lines.push(center(`Gracias por comprar en ${STORE_INFO.name}`))
  lines.push(center(`${STORE_INFO.ig} · ${STORE_INFO.web}`))
  lines.push(line('='))

  return lines
}

export function generateBoletaPDF(data: BoletaData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: [THERMAL_80MM.WIDTH_PT, 1000], // alto dinámico
    margins: {
      top:    THERMAL_80MM.MARGIN_PT,
      bottom: THERMAL_80MM.MARGIN_PT,
      left:   THERMAL_80MM.MARGIN_PT,
      right:  THERMAL_80MM.MARGIN_PT,
    },
  })

  doc
    .font('Courier')
    .fontSize(THERMAL_80MM.FONT_SIZE_PT)

  const textLines = renderBoletaText(data)

  for (const line of textLines) {
    doc.text(line, { lineGap: 2 })
  }

  doc.end()
  return doc
}
