// Tipos compartidos con el API, duplicados aquí para evitar dependencia de @seul/db en el POS

export type TillZReport = {
  tillId:            string
  tillSessionNumber: number
  shiftId:           string
  shiftNumber:       number
  cashierName:       string
  openedAt:          string
  closedAt:          string
  openingFloat:      number
  ticketCount:       number
  voidCount:         number
  refundCount:       number
  grossTotal:        number
  refundTotal:       number
  netTotal:          number
  byMethod: {
    cash:     number
    debit:    number
    credit:   number
    baes:     number
    qr:       number
    transfer: number
    [key: string]: number
  }
  expectedCash: number
}

export type MasterZReport = {
  shiftId:      string
  shiftNumber:  number
  openedAt:     string
  closedAt:     string
  tillCount:    number
  totalTickets: number
  totalVoids:   number
  totalRefunds: number
  grossTotal:   number
  refundTotal:  number
  netTotal:     number
  byMethod: {
    cash:     number
    debit:    number
    credit:   number
    baes:     number
    qr:       number
    transfer: number
    [key: string]: number
  }
  tills: Array<{
    tillId:            string
    tillSessionNumber: number
    cashierName:       string
    openedAt:          string
    closedAt:          string | null
    openingFloat:      number
    ticketCount:       number
    netTotal:          number
    byMethod:          Record<string, number>
  }>
}

// Legacy alias kept for compatibility
export type ZReport = TillZReport
