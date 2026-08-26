import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { orders } from './orders'

// Auditoría DTE — nunca se borra (SII exige trazabilidad 6 años)
export const dteEvents = pgTable('dte_events', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  attempt:         integer('attempt').notNull(),
  status:          text('status').notNull(),         // 'sent' | 'accepted' | 'rejected' | 'error'
  provider:        text('provider').notNull(),       // 'openfactura' | 'mock'
  requestPayload:  jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  errorCode:       text('error_code'),
  errorMessage:    text('error_message'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  orderIdx: index('dte_events_order_idx').on(t.orderId, t.createdAt),
}))
