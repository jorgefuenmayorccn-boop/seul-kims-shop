import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { customers } from './customers'

export const returnTypeEnum = pgEnum('return_type', [
  'defective',    // producto con defecto
  'wrong_item',   // producto incorrecto despachado
  'changed_mind', // arrepentimiento (Ley del Consumidor)
  'other',
])

export const returnStatusEnum = pgEnum('return_status', [
  'pending',   // recibida, sin revisar
  'approved',  // aprobada — pendiente de procesamiento
  'rejected',  // rechazada (fuera de plazo, sin justificación)
  'processed', // crédito/cambio/reembolso entregado
])

export const returns = pgTable('returns', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  customerId:      uuid('customer_id').references(() => customers.id),
  type:            returnTypeEnum('type').notNull(),
  reason:          text('reason').notNull(),
  refundAmountClp: integer('refund_amount_clp'),   // monto aprobado (admin)
  resolution:      text('resolution'),             // 'credit' | 'exchange' | 'refund_wap'
  status:          returnStatusEnum('status').default('pending'),
  notes:           text('notes'),                  // notas internas admin
  createdAt:       timestamp('created_at').defaultNow(),
  resolvedAt:      timestamp('resolved_at'),
})
