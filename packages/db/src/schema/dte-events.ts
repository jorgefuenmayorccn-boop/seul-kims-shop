import { pgTable, uuid, text, integer, jsonb, timestamp, index, boolean } from 'drizzle-orm/pg-core'
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

// NUEVO: Cola de reintentos DTE (automática cada hora)
export const dteRetryQueue = pgTable('dte_retry_queue', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  attemptNumber:   integer('attempt_number').notNull(),  // 1-3
  maxRetries:      integer('max_retries').default(3),
  status:          text('status').default('pending'),     // 'pending' | 'processing' | 'success' | 'failed'
  lastError:       text('last_error'),
  nextRetryAt:     timestamp('next_retry_at').notNull(), // cuándo reintentar (now + delay exponencial)
  createdAt:       timestamp('created_at').defaultNow(),
  processedAt:     timestamp('processed_at'),
}, (t) => ({
  pendingIdx: index('dte_queue_pending_idx').on(t.status, t.nextRetryAt),
}))
