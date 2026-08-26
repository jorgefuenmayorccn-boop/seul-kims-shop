import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { orders } from './orders'

export const promotionTypeEnum = pgEnum('promotion_type', ['percent', 'amount', 'free_shipping'])

export const promotions = pgTable('promotions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  code:             text('code').notNull().unique(),
  type:             promotionTypeEnum('type').notNull(),
  value:            integer('value').notNull(),         // % si percent, CLP si amount
  minSubtotal:      integer('min_subtotal').notNull().default(0),
  maxUses:          integer('max_uses'),                // null = ilimitado
  usedCount:        integer('used_count').notNull().default(0),
  perCustomerLimit: integer('per_customer_limit').notNull().default(1),
  startsAt:         timestamp('starts_at'),
  endsAt:           timestamp('ends_at'),
  active:           boolean('active').notNull().default(true),
  description:      text('description'),
  createdAt:        timestamp('created_at').defaultNow(),
}, t => ({
  codeIdx: index('promotions_code_idx').on(t.code),
}))

export const promotionRedemptions = pgTable('promotion_redemptions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  promotionId:     uuid('promotion_id').notNull().references(() => promotions.id),
  customerId:      uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  orderId:         uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  discountApplied: integer('discount_applied').notNull(),
  redeemedAt:      timestamp('redeemed_at').defaultNow(),
})
