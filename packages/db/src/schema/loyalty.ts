import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { orders } from './orders'
import { users } from './auth'

export const loyaltyLedgerTypeEnum = pgEnum('loyalty_ledger_type', [
  'earn',    // gana puntos por compra — automático
  'redeem',  // canjea puntos por descuento
  'adjust',  // ajuste manual desde Cerebro
  'expire',  // expiración automática
])

// Regla: 1 punto por cada CLP 1.000 gastado
// Canje: 1.000 puntos = CLP 1.000 de descuento
export const loyaltyLedger = pgTable('loyalty_ledger', {
  id:         uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  orderId:    uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  type:       loyaltyLedgerTypeEnum('type').notNull(),
  points:     integer('points').notNull(),  // positivo: earn/adjust. negativo: redeem/expire
  reason:     text('reason'),
  createdBy:  uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:  timestamp('created_at').defaultNow(),
})
