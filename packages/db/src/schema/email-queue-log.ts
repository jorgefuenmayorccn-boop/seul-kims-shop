import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { orders } from './orders'

export const emailQueueLog = pgTable('email_queue_log', {
  id:             uuid('id').primaryKey().defaultRandom(),
  orderId:        uuid('order_id').notNull().references(() => orders.id),
  triggerType:    text('trigger_type').notNull(), // 'order_created' | 'order_dispatched' | 'order_delivered'
  status:         text('status').notNull().default('queued'), // 'queued' | 'sent' | 'failed' | 'skipped'
  attempt:        integer('attempt').notNull().default(1),
  recipientEmail: text('recipient_email'),
  resendId:       text('resend_id'),
  errorDetail:    text('error_detail'),
  queuedAt:       timestamp('queued_at').defaultNow().notNull(),
  processedAt:    timestamp('processed_at'),
}, (t) => ({
  orderIdx: index('email_queue_log_order_idx').on(t.orderId, t.queuedAt),
}))
