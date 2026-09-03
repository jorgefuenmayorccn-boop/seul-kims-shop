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
  itemCount:     number
}

export type PrintMode   = 'agent' | 'fallback' | 'unavailable'
export type PrintStatus = 'idle' | 'printing' | 'success' | 'error'

export interface PrintResult {
  ok:    boolean
  mode:  PrintMode
  error?: string
}
