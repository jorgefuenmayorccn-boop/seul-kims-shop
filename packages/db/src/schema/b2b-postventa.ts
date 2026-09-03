import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { b2bCompanies } from './customers'

// Solicitudes de postventa B2B (adición post-entrega, 3-sep-2026, migración
// 0024b en packages/api/src/server.ts) — reconciliado acá el 3-sep-2026
// (Fase 0 del plan multilocal). Antes la página de postventa de POS solo
// abría un link de WhatsApp sin persistir nada; ahora se guarda acá.
export const b2bPostventaRequests = pgTable('b2b_postventa_requests', {
  id:           uuid('id').primaryKey().defaultRandom(),
  companyId:    uuid('company_id').notNull().references(() => b2bCompanies.id),
  issueType:    text('issue_type').notNull(),
  orderNumber:  text('order_number'),
  description:  text('description').notNull(),
  contactPhone: text('contact_phone'),
  status:       text('status').notNull().default('pending'),
  createdAt:    timestamp('created_at').defaultNow(),
})
