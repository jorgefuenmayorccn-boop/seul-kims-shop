export type DteType = 'nota_venta' | 'boleta' | 'factura'
export type DteStatus = 'pending' | 'sending' | 'issued' | 'accepted_sii' | 'rejected_sii' | 'failed'

export interface DteEmitter {
  rut:         string
  razonSocial: string
  giro:        string
  direccion:   string
  comuna:      string
}

export interface DteReceiver {
  rut:         string
  razonSocial: string
  giro:        string
  direccion:   string
  comuna:      string
}

export interface DteItem {
  sku?:      string
  name:      string
  qty:       number
  unitPrice: number
}

export interface DtePayment {
  method: string
  amount: number
}

export interface DteRequest {
  type:         DteType
  idempotencyKey: string   // orderId-attempt para evitar duplicados
  emitter:      DteEmitter
  receiver?:    DteReceiver
  items:        DteItem[]
  payments:     DtePayment[]
  totalNet:     number
  totalIva:     number
  totalGross:   number
}

export interface DteResponse {
  folio:    number
  trackId:  string   // ID de seguimiento SII
  ted:      string   // TED XML timbrado (para PDF417)
  pdfUrl?:  string   // URL del PDF del proveedor
  timbre:   Date
}

export interface DteStatusResponse {
  status:  DteStatus
  folio?:  string
  pdfUrl?: string
}
