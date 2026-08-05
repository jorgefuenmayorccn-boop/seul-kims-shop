import { pgTable, uuid, text, boolean, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'

export const b2bTierEnum = pgEnum('b2b_tier', ['hoobae', 'sunbae', 'hyung'])
export const b2bStatusEnum = pgEnum('b2b_status', ['pending', 'approved', 'rejected', 'suspended'])

export const customers = pgTable('customers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     text('email').unique(),
  phone:     text('phone'),
  name:      text('name').notNull(),
  rut:       text('rut'),
  isBaes:    boolean('is_baes').default(false),   // alumno JUNAEB
  createdAt: timestamp('created_at').defaultNow(),
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
  creditLimitClp: integer('credit_limit_clp').default(500000),
  creditUsedClp:  integer('credit_used_clp').default(0),
  paymentDays:    integer('payment_days').default(0),  // 0=contado, 15, 30, 45
  createdAt:      timestamp('created_at').defaultNow(),
  approvedAt:     timestamp('approved_at'),
})

// Solicitudes ARCOP (Ley 21.719 — privacidad)
export const arcopRequests = pgTable('arcop_requests', {
  id:          uuid('id').primaryKey().defaultRandom(),
  customerId:  uuid('customer_id').references(() => customers.id),
  type:        text('type').notNull(),  // 'access' | 'rectification' | 'deletion' | 'portability'
  status:      text('status').default('pending'),
  notes:       text('notes'),
  deadline:    timestamp('deadline'),  // 15 días hábiles por Ley 21.719
  createdAt:   timestamp('created_at').defaultNow(),
  resolvedAt:  timestamp('resolved_at'),
})
