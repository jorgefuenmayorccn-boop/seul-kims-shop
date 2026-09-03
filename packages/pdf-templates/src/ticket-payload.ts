// Payload compartido entre POS y print-agent para generar tickets

export type TicketDocType = 'nota_venta' | 'boleta' | 'factura'

export interface TicketStoreInfo {
  name:    string
  address: string
  rut:     string
  giro:    string
  phone:   string
  ig:      string
  web:     string
}

export interface TicketItem {
  name:      string
  qty:       number
  unitPrice: number
  subtotal:  number
  isBaes?:   boolean
  sellos?:   string[]
}

export interface TicketPayment {
  method: string
  amount: number
  label:  string
}

export interface TicketReceiver {
  rut:         string
  razonSocial: string
  giro:        string
  direccion:   string
  comuna:      string
}

export interface TicketPayload {
  orderId:            string
  ticketType:         TicketDocType
  number:             number        // N° interno POS (000123)
  folio?:             string        // Folio SII (boleta/factura)
  date:               string        // ISO string
  cashier?:           string
  shiftNumber?:       number        // Turno activo al emitir
  tillSessionNumber?: number        // Caja activa al emitir
  items:              TicketItem[]
  subtotal:           number
  baesAmount:         number
  total:              number
  payments:           TicketPayment[]
  cashReceived?:      number
  change?:            number
  receiver?:          TicketReceiver
  ted?:               string        // TED XML timbrado SII
  storeInfo:          TicketStoreInfo
  isReprint?:         boolean       // agrega línea "*** COPIA ***"
  dteStatus?:         string        // 'pending' | 'issued' | 'failed' para badge
  // Entrega (adición post-entrega, 3-sep-2026) — antes la boleta/nota de
  // venta no mostraba NADA de la entrega para pedidos con delivery/Metro,
  // aunque la comanda y la etiqueta ya lo tuvieran. `deliveryComuna` es el
  // campo estructurado (migración 0024c) — separado de `deliveryAddress`,
  // que puede venir ya concatenado con la comuna por compatibilidad.
  deliveryMode?:      'rappi' | 'metro' | 'pickup' | 'shipping' | 'delivery'
  deliveryAddress?:   string
  deliveryComuna?:    string
  metroStation?:      string
  metroSlot?:         string
  deliveryDate?:      string        // yyyy-mm-dd
}

// Payload para comandas de producción — sin precios, máxima legibilidad
export interface ComandaPayload {
  orderId:       string
  number:        number
  channel:       'pos' | 'web' | 'b2b' | 'whatsapp'
  createdAt:     string          // ISO — se muestra como HH:MM
  items: Array<{
    name:        string
    qty:         number
    notes?:      string          // modificadores / instrucciones
  }>
  deliveryMode:  'rappi' | 'metro' | 'pickup' | 'shipping'
  notes?:        string          // nota general del pedido
  metroStation?: string
  metroSlot?:    string
  // Fecha de retiro Metro elegida en el checkout (adición post-entrega,
  // 3-sep-2026) — antes solo existía la franja horaria, sin día.
  deliveryDate?: string          // yyyy-mm-dd
  // Nombre de quien recibe — para CUALQUIER canal, no solo B2B (antes solo
  // se armaba vía notes:"Recibe: X" para pedidos B2B; el personal no tenía
  // forma de saber a quién entregarle un retiro Metro normal).
  recipientName?: string
  cashierName?:  string          // si channel === 'pos'
}

// Etiqueta para pegar en caja/bolsa (adición post-entrega, rediseño B2B,
// 2-sep-2026) — antes no existía ningún documento de este tipo (grep
// confirmado, 0 resultados en pdf-templates/apps/cerebro/apps/pos). Se
// imprime desde el mismo punto que la comanda, mismo `htmlShell`.
export interface EtiquetaPayload {
  orderId:       string
  number:        number
  channel:       'pos' | 'web' | 'b2b' | 'whatsapp'
  companyName?:  string          // razón social si es pedido B2B
  recipient?:    string          // "quién recibe" si es distinto al titular
  deliveryMode:  'rappi' | 'metro' | 'pickup' | 'shipping'
  deliveryAddress?: string
  metroStation?: string
  metroSlot?:    string
  deliveryDate?: string          // yyyy-mm-dd — adición post-entrega 3-sep-2026
  itemCount:     number
}

export type PrintMode   = 'agent' | 'fallback' | 'unavailable'
export type PrintStatus = 'idle' | 'printing' | 'success' | 'error'

export interface PrintResult {
  ok:    boolean
  mode:  PrintMode
  error?: string
}
