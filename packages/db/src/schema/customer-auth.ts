import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const customerSessions = pgTable('customer_sessions', {
  id:        text('id').primaryKey(),              // 32 bytes → 64 hex chars
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),    // rolling 7 días
  ip:        text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
}, t => ({
  customerIdx: index('customer_sessions_customer_idx').on(t.customerId),
  expIdx:      index('customer_sessions_exp_idx').on(t.expiresAt),
}))

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  token:      text('token').primaryKey(),          // 32 bytes → 64 hex chars
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  expiresAt:  timestamp('expires_at').notNull(),   // 24h TTL
  usedAt:     timestamp('used_at'),
  createdAt:  timestamp('created_at').defaultNow(),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  token:      text('token').primaryKey(),          // 32 bytes → 64 hex chars
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  expiresAt:  timestamp('expires_at').notNull(),   // 1h TTL
  usedAt:     timestamp('used_at'),
  createdAt:  timestamp('created_at').defaultNow(),
})

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id:             uuid('id').primaryKey().defaultRandom(),
  email:          text('email').notNull().unique(),
  source:         text('source'),                  // 'footer' | 'checkout' | 'modal'
  confirmToken:   text('confirm_token'),           // token double opt-in
  confirmedAt:    timestamp('confirmed_at'),
  optInAt:        timestamp('opt_in_at').defaultNow(),
  optOutAt:       timestamp('opt_out_at'),
}, t => ({
  emailIdx: index('newsletter_email_idx').on(t.email),
}))

export const consents = pgTable('consents', {
  id:              uuid('id').primaryKey().defaultRandom(),
  customerId:      uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  type:            text('type').notNull(),         // 'tos' | 'privacy' | 'marketing' | 'whatsapp'
  versionAccepted: text('version_accepted'),       // e.g. '2026-08-01'
  acceptedAt:      timestamp('accepted_at').defaultNow(),
  revokedAt:       timestamp('revoked_at'),
  ip:              text('ip'),
  userAgent:       text('user_agent'),
  evidence:        text('evidence'),               // JSON — texto exacto mostrado al usuario
}, t => ({
  customerIdx: index('consents_customer_idx').on(t.customerId),
}))
