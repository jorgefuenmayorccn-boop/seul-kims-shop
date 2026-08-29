import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { b2bCompanies } from './customers'
import { users } from './auth'

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',      // Borrador, aún no enviado
  'sent',       // Enviado a cliente
  'viewed',     // Cliente vio la cotización
  'accepted',   // Aceptada → genera orden automáticamente
  'rejected',   // Rechazada
  'expired',    // Pasó fecha expiración
  'cancelled',  // Cancelada por admin
])

export const b2bQuotes = pgTable('b2b_quotes', {
  id:             uuid('id').primaryKey().defaultRandom(),
  number:         integer('number').notNull(),                   // número visible: #12345
  companyId:      uuid('company_id').notNull().references(() => b2bCompanies.id),
  buyerName:      text('buyer_name').notNull(),                  // nombre contacto
  buyerEmail:     text('buyer_email').notNull(),                 // email destino
  buyerPhone:     text('buyer_phone'),
  status:         quoteStatusEnum('status').notNull().default('draft'),

  // Contenido
  items:          jsonb('items').notNull(),  // [{sku, name, qty, unitPrice, subtotal}, ...]
  subtotal:       decimal('subtotal', { precision: 12, scale: 0 }).notNull(),
  discount:       decimal('discount', { precision: 12, scale: 0 }).default('0'),
  tax:            decimal('tax', { precision: 12, scale: 0 }).default('0'),
  total:          decimal('total', { precision: 12, scale: 0 }).notNull(),

  // Términos
  paymentTerms:   text('payment_terms'),           // "neto 30", "contado", etc
  deliveryDays:   integer('delivery_days'),        // días para entregar
  validUntilAt:   timestamp('valid_until_at'),     // fecha expiración cotización
  notes:          text('notes'),                   // notas adicionales

  // Auditoría
  createdBy:      uuid('created_by').references(() => users.id),
  createdAt:      timestamp('created_at').defaultNow(),
  sentAt:         timestamp('sent_at'),
  acceptedAt:     timestamp('accepted_at'),
  rejectedAt:     timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  expiredAt:      timestamp('expired_at'),
  updatedAt:      timestamp('updated_at').defaultNow(),
})
