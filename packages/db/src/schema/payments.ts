import { pgTable, uuid, text, decimal, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { orders } from './orders'

export const paymentMethodEnum = [
  'cash', 'debit', 'credit', 'baes', 'qr', 'transfer',
] as const

export type PaymentMethodDb = typeof paymentMethodEnum[number]

// Pagos asociados a una orden — soporta múltiples tenders por venta
export const orderPayments = pgTable('order_payments', {
  id:        uuid('id').primaryKey().defaultRandom(),
  orderId:   uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  method:    text('method').notNull(),   // 'cash' | 'debit' | 'credit' | 'qr'
  amount:    decimal('amount', { precision: 10, scale: 0 }).notNull(),
  meta:      jsonb('meta'),              // { authCode, last4, cashReceived, change }
  createdAt: timestamp('created_at').defaultNow(),
})
