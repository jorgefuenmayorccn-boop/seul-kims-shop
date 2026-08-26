// Tipos y helpers para el sistema de pagos del POS

export type PaymentMethodId =
  | 'cash'
  | 'debit'
  | 'credit'
  | 'baes'
  | 'qr'
  | 'mixed'
  | 'cod'

export interface PaymentMethod {
  id:       PaymentMethodId
  label:    string
  labelKo:  string
  desc:     string
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash',   label: 'Efectivo',    labelKo: '현금',   desc: 'Calcular vuelto' },
  { id: 'debit',  label: 'Débito',      labelKo: '직불카드', desc: 'Tarjeta de débito' },
  { id: 'credit', label: 'Crédito',     labelKo: '신용카드', desc: 'Tarjeta de crédito' },
  { id: 'baes',   label: 'BAES',        labelKo: 'BAES',   desc: 'Subsidio JUNAEB + TNE' },
  { id: 'qr',     label: 'QR / Transferencia', labelKo: '이체', desc: 'QR o transferencia bancaria' },
  { id: 'mixed',  label: 'Pago mixto',  labelKo: '혼합',   desc: 'Varios medios de pago' },
]

// Un tender es un pago parcial con método y monto
export interface Tender {
  method: Exclude<PaymentMethodId, 'mixed' | 'baes'>
  amount: number
  meta?:  Record<string, string>
}

export function isCOD(tenders: Tender[]): boolean {
  return tenders.some(t => t.method === 'cod')
}

// Montos rápidos de efectivo en CLP
export const QUICK_CASH_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

export function calcChange(received: number, total: number): number {
  return Math.max(0, received - total)
}

export function calcRemaining(total: number, tenders: Tender[]): number {
  const paid = tenders.reduce((acc, t) => acc + t.amount, 0)
  return Math.max(0, total - paid)
}

export function isCovered(total: number, tenders: Tender[]): boolean {
  return calcRemaining(total, tenders) === 0
}

export function tenderMethodLabel(method: Tender['method']): string {
  return PAYMENT_METHODS.find(m => m.id === method)?.label ?? method
}
