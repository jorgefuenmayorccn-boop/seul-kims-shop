import { pgTable, uuid, text, boolean, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './auth'

export const b2bTierEnum = pgEnum('b2b_tier', ['hoobae', 'sunbae', 'hyung'])
export const b2bStatusEnum = pgEnum('b2b_status', ['pending', 'approved', 'rejected', 'suspended'])

export const customers = pgTable('customers', {
  id:                uuid('id').primaryKey().defaultRandom(),
  email:             text('email').unique(),
  phone:             text('phone'),
  name:              text('name').notNull(),
  rut:               text('rut'),
  isBaes:            boolean('is_baes').default(false),
  // Auth B2C
  passwordHash:      text('password_hash'),
  emailVerified:     boolean('email_verified').notNull().default(false),
  emailVerifiedAt:   timestamp('email_verified_at'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  // Marketing — Ley 21.719 opt-in explícito
  marketingOptIn:    boolean('marketing_opt_in').notNull().default(false),
  marketingOptInAt:  timestamp('marketing_opt_in_at'),
  // Seguridad
  lastLoginAt:       timestamp('last_login_at'),
  failedAttempts:    integer('failed_attempts').notNull().default(0),
  lockedUntil:       timestamp('locked_until'),
  // RGPD / Ley 21.719 — derecho de supresión
  deletedAt:         timestamp('deleted_at'),
  createdAt:         timestamp('created_at').defaultNow(),
  // Customer 360 — identificación cross-platform
  documentType:      text('document_type').default('rut'),    // 'rut' | 'dni' | 'passport'
  documentNumber:    text('document_number'),                  // normalizado sin puntos ni guiones
  createdChannel:    text('created_channel').default('web'),  // 'pos' | 'web' | 'b2b' | 'import'
  // Delivery — dirección primaria del cliente (CRM en caja)
  address:           text('address'),
  commune:           text('commune'),
  addressNotes:      text('address_notes'),  // instrucciones: "Dejar en portería", etc.
})

// Empresas B2B
export const b2bCompanies = pgTable('b2b_companies', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     uuid('customer_id').notNull().references(() => customers.id),
  razonSocial:    text('razon_social').notNull(),
  rut:            text('rut').notNull().unique(),
  giro:           text('giro'),
  address:        text('address'),
  tier:           b2bTierEnum('tier').default('hoobae'),
  status:         b2bStatusEnum('status').default('pending'),
  creditLimitClp:   integer('credit_limit_clp').default(500000),
  creditUsedClp:    integer('credit_used_clp').default(0),
  walletBalanceClp: integer('wallet_balance_clp').notNull().default(0),
  paymentDays:      integer('payment_days').default(0),
  createdAt:        timestamp('created_at').defaultNow(),
  approvedAt:       timestamp('approved_at'),
})

// Solicitudes ARCOP (Ley 21.719 — privacidad)
export const arcopRequests = pgTable('arcop_requests', {
  id:          uuid('id').primaryKey().defaultRandom(),
  customerId:  uuid('customer_id').references(() => customers.id),
  type:        text('type').notNull(),
  status:      text('status').default('pending'),
  notes:       text('notes'),
  deadline:    timestamp('deadline'),
  createdAt:   timestamp('created_at').defaultNow(),
  resolvedAt:  timestamp('resolved_at'),
})

// Solicitudes de crédito B2B (migrate-0010)
export const b2bCreditRequests = pgTable('b2b_credit_requests', {
  id:           uuid('id').primaryKey().defaultRandom(),
  companyId:    uuid('company_id').notNull().references(() => b2bCompanies.id),
  amountClp:    integer('amount_clp').notNull(),
  reason:       text('reason'),
  status:       text('status').notNull().default('pending'),
  reviewedBy:   uuid('reviewed_by').references(() => users.id),
  reviewedAt:   timestamp('reviewed_at'),
  reviewerNote: text('reviewer_note'),
  docR2Key:     text('doc_r2_key'),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
})

// Ledger de wallet B2B (migrate-0010)
export const b2bWalletLedger = pgTable('b2b_wallet_ledger', {
  id:            uuid('id').primaryKey().defaultRandom(),
  companyId:     uuid('company_id').notNull().references(() => b2bCompanies.id),
  type:          text('type').notNull(),   // 'credit' | 'debit' | 'adjustment'
  amountClp:     integer('amount_clp').notNull(),
  balanceAfter:  integer('balance_after').notNull(),
  referenceId:   uuid('reference_id'),
  referenceType: text('reference_type'),
  notes:         text('notes'),
  createdBy:     uuid('created_by').references(() => users.id),
  createdAt:     timestamp('created_at').defaultNow(),
})
