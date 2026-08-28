// Especificaciones técnicas impresora térmica 80mm
// Epson TM-T20 y compatibles — papel 80mm, área imprimible 72mm

export const THERMAL_80MM = {
  WIDTH_MM: 80,
  PRINTABLE_MM: 72,
  WIDTH_PT: 226.77,      // 80mm en puntos
  PRINTABLE_PT: 204.09,  // 72mm en puntos
  CHARS_PER_LINE: 42,    // con JetBrains Mono 8pt
  FONT_SIZE_PT: 8,
  FONT_SIZE_SMALL_PT: 7,
  MARGIN_PT: 11.34,      // (226.77 - 204.09) / 2
  DPI: 203,
  LINE_HEIGHT_PT: 10,
} as const

export const STORE_INFO = {
  name: 'SEOUL KIMS',
  address: 'CONFIRMAR CON DUEÑO',  // Av. Libertad XXXX, Viña del Mar
  rut: 'XX.XXX.XXX-X',            // RUT real del negocio
  giro: 'COMERCIO AL POR MENOR',
  phone: '+56 9 XXXX XXXX',
  ig: '@seulshopcl',
  web: 'seoulshop.cl',
} as const
