import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { users } from './auth'

// Auditoría de anulaciones del POS — trail inmutable
export const posVoidEvents = pgTable('pos_void_events', {
  id:            uuid('id').primaryKey().defaultRandom(),
  orderId:       uuid('order_id').notNull().references(() => orders.id),
  voidedBy:      uuid('voided_by').notNull().references(() => users.id),
  reason:        text('reason').notNull(),
  amountClp:     integer('amount_clp').notNull(),
  createdAt:     timestamp('created_at').defaultNow(),
})
