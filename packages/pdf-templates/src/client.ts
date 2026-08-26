// Exports browser-safe — NO importa pdfkit ni Node.js fs

// Tipos y renderer legacy (ESC/POS agent path)
export { renderTicketLines } from './ticket-renderer'
export type {
  TicketPayload, TicketItem, TicketPayment, TicketReceiver,
  TicketDocType, TicketStoreInfo, PrintMode, PrintStatus, PrintResult,
  ComandaPayload,
} from './ticket-payload'
export { THERMAL_80MM, STORE_INFO } from './constants'

// Templates HTML — quiet luxury print engine
export { renderPosReceiptHtml }   from './html/pos-receipt'
export { renderTillZReportHtml, renderMasterZReportHtml } from './html/z-report'
export { renderComandaHtml }      from './html/comanda'
export { renderDeliveryPayoutHtml } from './html/delivery-payout'
export type { DeliveryPayoutData }  from './html/delivery-payout'
export type { TillZReport, MasterZReport } from './html/z-report'
